import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import Database from 'better-sqlite3';

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

  logToFile('service_log.txt', '--- Wilder Server Starting ---');
  
  const app = express();
  const PORT = 3000;
  
  logToFile('service_log.txt', `Attempting to initialize database at ${path.join(process.cwd(), 'wilder.db')}...`);
  const db = new Database('wilder.db');
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
    
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (isReading !== undefined) { updates.push('isReading = ?'); params.push(isReading ? 1 : 0); }
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
  if (process.env.NODE_ENV !== 'production') {
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

  app.listen(PORT, '0.0.0.0', () => {
    logToFile('service_log.txt', `Server successfully listening on http://0.0.0.0:${PORT}`);
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
