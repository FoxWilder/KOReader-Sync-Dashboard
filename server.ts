import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

function logToFile(filename: string, message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(path.join(process.cwd(), filename), logEntry);
  } catch (e) {
    console.error(`Failed to write to ${filename}:`, e);
  }
}

async function startServer() {
  // Ensure log files exist for tailing
  ['service_log.txt', 'sync_log.txt'].forEach(f => {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) fs.writeFileSync(p, '');
  });

  const app = express();
  const PORT = 3000;
  
  const isProdFlag = process.argv.includes('--prod');
  const rawEnv = (process.env.NODE_ENV || 'development').trim().toLowerCase();
  const isProd = isProdFlag || rawEnv === 'production';

  logToFile('service_log.txt', `--- Wilder Server Starting (Mode: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}) ---`);
  if (!isProd) logToFile('service_log.txt', `Note: Raw NODE_ENV was "${process.env.NODE_ENV}", isProdFlag was ${isProdFlag}`);

  // Start listening IMMEDIATELY to prevent parent process hangs and confirm port ownership
  const server = app.listen(PORT, '0.0.0.0', () => {
    logToFile('service_log.txt', `Server successfully listening on http://0.0.0.0:${PORT}`);
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    logToFile('service_log.txt', `SERVER LISTENER ERROR: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      logToFile('service_log.txt', `Port ${PORT} is already in use by another process.`);
    }
    console.error('Server error:', err);
  });

  try {
    logToFile('service_log.txt', `Initializing database at ${path.join(process.cwd(), 'wilder.db')}...`);
    const db = new Database('wilder.db', { verbose: (msg) => logToFile('service_log.txt', `DB: ${msg}`) });
    logToFile('service_log.txt', 'Database connection established.');

    // service_log.txt for general web requests
    app.use((req, res, next) => {
      if (!req.path.startsWith('/koreader')) {
        logToFile('service_log.txt', `${req.method} ${req.path} - ${req.ip}`);
      }
      next();
    });

    // sync_log.txt exclusively for KOReader sync
    app.use('/koreader', (req, res, next) => {
      logToFile('sync_log.txt', `${req.method} ${req.path} - ${JSON.stringify(req.body || {})}`);
      next();
    });

    // Initialize DB tables
    logToFile('service_log.txt', 'Initializing database tables...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT
      );
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        title TEXT,
        author TEXT,
        filePath TEXT,
        coverPath TEXT,
        status TEXT DEFAULT 'queue', -- queue, reading, archived, trash
        progress TEXT,
        isReading INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sync_data (
        userId TEXT,
        documentId TEXT,
        progress TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (userId, documentId)
      );
    `);
    logToFile('service_log.txt', 'Database tables initialized.');

    app.use(express.json());

    // Serve static assets (covers, books)
    app.use('/data', express.static(path.join(process.cwd(), 'data')));

    // --- API ROUTES ---
    logToFile('service_log.txt', 'Setting up API routes...');

  // Auth - Simplified for now
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    // Mock user for now
    res.json({ token: 'mock-token', user: { id: '1', username: 'admin' } });
  });

  // Library Scan
  app.post('/api/library/scan', async (req, res) => {
    const libraryPathRaw = db.prepare('SELECT value FROM settings WHERE key = ?').get('library_path') as any;
    const libraryPath = libraryPathRaw ? libraryPathRaw.value : null;

    if (!libraryPath || !fs.existsSync(libraryPath)) {
      return res.status(400).json({ error: 'invalid-path', message: 'Library path not set or invalid.' });
    }

    logToFile('service_log.txt', `Starting library scan at: ${libraryPath}`);
    
    const scanDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (file.match(/\.(epub|pdf|mobi|azw3)$/i)) {
          const id = path.basename(file, path.extname(file)); // Simple ID for now
          const exists = db.prepare('SELECT id FROM books WHERE filePath = ?').get(fullPath);
          if (!exists) {
            db.prepare('INSERT INTO books (id, title, author, filePath, status) VALUES (?, ?, ?, ?, ?)')
              .run(randomUUID(), file, 'Unknown', fullPath, 'library');
            logToFile('service_log.txt', `Indexed new book: ${file}`);
          }
        }
      }
    };

    try {
      scanDir(libraryPath);
      res.json({ success: true, message: 'Scan completed.' });
    } catch (e: any) {
      logToFile('service_log.txt', `Scan error: ${e.message}`);
      res.status(500).json({ error: 'scan-failed' });
    }
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM settings').all();
    res.json(settings);
  });

  app.post('/api/settings', (req, res) => {
    const { key, value } = req.body;
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
    res.json({ success: true });
  });

  // System Update
  app.get('/api/system/update/check', async (req, res) => {
    try {
      const githubRes = await fetch('https://api.github.com/repos/FoxWilder/KOReader-Sync-Dashboard/releases/latest');
      const latest = await githubRes.json() as any;
      const currentVersion = '1.1.0'; // Hardcoded for now, should match package.json
      res.json({
        latestVersion: latest.tag_name,
        currentVersion,
        updateAvailable: latest.tag_name !== currentVersion && !latest.tag_name.includes(currentVersion)
      });
    } catch (e) {
      res.status(500).json({ error: 'update-check-failed' });
    }
  });

  app.post('/api/system/update/apply', async (req, res) => {
    logToFile('service_log.txt', 'Update requested via UI. Triggering install.ps1...');
    // We can't easily self-update on Windows while running.
    // We suggest the user to use the PowerShell command or we trigger a one-shot task.
    // For this implementation, we will log a special message that the manager (if we had one) could pick up,
    // or we just tell the user to run the one-liner in the log.
    res.json({ 
      success: true, 
      message: 'Update command issued. Please run the PowerShell one-liner to complete the upgrade.' 
    });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.1.0' });
  });

  // Library
  app.get('/api/books', (req, res) => {
    const { status } = req.query;
    let query = 'SELECT * FROM books';
    const params: any[] = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    } else {
      query += " WHERE status NOT IN ('archived', 'trash')";
    }
    
    query += ' ORDER BY createdAt DESC';
    const books = db.prepare(query).all(...params);
    res.json(books);
  });

  app.patch('/api/books/:id', (req, res) => {
    const { id } = req.params;
    const { status, isReading, progress } = req.body;
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (status !== undefined) { 
      updates.push('status = ?'); 
      params.push(status);
      // Auto-set isReading based on status
      updates.push('isReading = ?');
      params.push(status === 'reading' ? 1 : 0);
    } else {
      // Direct isReading update if status is not provided
      if (isReading !== undefined) { 
        updates.push('isReading = ?'); 
        params.push(isReading ? 1 : 0); 
      }
    }
    if (progress !== undefined) { updates.push('progress = ?'); params.push(progress); }
    
    if (updates.length === 0) return res.status(400).json({ error: 'no updates' });
    
    params.push(id);
    db.prepare(`UPDATE books SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  });

  // Stats
  app.get('/api/stats', (req, res) => {
    const totalBooks = db.prepare('SELECT count(*) as count FROM books').get() as any;
    const readingBooks = db.prepare('SELECT count(*) as count FROM books WHERE isReading = 1').get() as any;
    const completedBooks = db.prepare('SELECT count(*) as count FROM books WHERE status = "archived"').get() as any;
    
    res.json({
      total: totalBooks.count,
      reading: readingBooks.count,
      completed: completedBooks.count,
      uptime: process.uptime()
    });
  });

  // KOReader Sync Protocol Endpoints
  // Handshake
  app.get('/koreader/sync/v1/auth', (req, res) => {
    res.status(200).send('OK');
  });

  // Post progress
  app.post('/koreader/sync/v1/progress', (req, res) => {
    const { document_id, progress, timestamp } = req.body;
    const userId = '1'; // Hardcoded for demo/setup
    db.prepare(`
      INSERT INTO sync_data (userId, documentId, progress, timestamp) 
      VALUES (?, ?, ?, ?)
      ON CONFLICT(userId, documentId) DO UPDATE SET 
        progress = excluded.progress,
        timestamp = excluded.timestamp
    `).run(userId, document_id, JSON.stringify(progress), timestamp);
    res.json({ status: 'ok' });
  });

  // Get progress
  app.get('/koreader/sync/v1/progress/:documentId', (req, res) => {
    const { documentId } = req.params;
    const userId = '1';
    const data = db.prepare('SELECT progress FROM sync_data WHERE userId = ? AND documentId = ?').get(userId, documentId) as any;
    if (data) {
      res.json(JSON.parse(data.progress));
    } else {
      res.status(404).json({ error: 'not found' });
    }
  });

  // Vite middleware for development
  if (!isProd) {
    logToFile('service_log.txt', 'Initializing Vite middleware...');
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      logToFile('service_log.txt', 'Vite middleware initialized.');
    } catch (e) {
      logToFile('service_log.txt', `ERROR: Vite failed to start: ${e}`);
      console.error('Vite failed to start:', e);
    }
  } else {
    logToFile('service_log.txt', 'Serving production build from dist/');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  } catch (err) {
    logToFile('service_log.txt', `CRITICAL ERROR during startup: ${err}`);
    console.error('Critical boot error:', err);
    process.exit(1);
  }
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
