import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import Database from 'better-sqlite3';
import { randomUUID, createHash } from 'crypto';
import AdmZip from 'adm-zip';

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
  // Ensure directories exist
  ['logs', 'storage', 'data/covers'].forEach(d => {
    const p = path.join(process.cwd(), d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });

  // Ensure log files exist
  ['service_log.txt', 'sync_log.txt'].forEach(f => {
    const p = path.join(process.cwd(), 'logs', f);
    if (!fs.existsSync(p)) fs.writeFileSync(p, '');
  });

  const app = express();
  const PORT = 3000;
  
  const isProdFlag = process.argv.includes('--prod');
  const rawEnv = (process.env.NODE_ENV || 'development').trim().toLowerCase();
  const isProd = isProdFlag || rawEnv === 'production';

  logToFile('logs/service_log.txt', `--- Wilder Server Starting (Mode: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}) ---`);
  if (!isProd) logToFile('logs/service_log.txt', `Note: Raw NODE_ENV was "${process.env.NODE_ENV}", isProdFlag was ${isProdFlag}`);

  // Start listening IMMEDIATELY to prevent parent process hangs and confirm port ownership
  const server = app.listen(PORT, '0.0.0.0', () => {
    logToFile('logs/service_log.txt', `Server successfully listening on http://0.0.0.0:${PORT}`);
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    logToFile('logs/service_log.txt', `SERVER LISTENER ERROR: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      logToFile('logs/service_log.txt', `Port ${PORT} is already in use by another process.`);
    }
    console.error('Server error:', err);
  });

  try {
    const dbPath = path.join(process.cwd(), 'storage', 'wilder.db');
    logToFile('logs/service_log.txt', `Initializing database at ${dbPath}...`);
    const db = new Database(dbPath, { verbose: (msg) => logToFile('logs/service_log.txt', `DB: ${msg}`) });
    logToFile('logs/service_log.txt', 'Database connection established.');

    // logs/service_log.txt for general web requests
    app.use((req, res, next) => {
      if (!req.path.startsWith('/koreader')) {
        logToFile('logs/service_log.txt', `${req.method} ${req.path} - ${req.ip}`);
      }
      next();
    });

    // logs/sync_log.txt exclusively for KOReader sync
    app.use('/koreader', (req, res, next) => {
      logToFile('logs/sync_log.txt', `${req.method} ${req.path} - ${JSON.stringify(req.body || {})}`);
      next();
    });

    // Initialize DB tables
    logToFile('logs/service_log.txt', 'Initializing database tables...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        displayName TEXT,
        avatarUrl TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        title TEXT,
        author TEXT,
        description TEXT,
        publisher TEXT,
        publishedDate TEXT,
        language TEXT,
        subject TEXT,
        aiSector TEXT,
        filePath TEXT,
        coverPath TEXT,
        status TEXT DEFAULT 'library',
        progress TEXT,
        size INTEGER,
        pages INTEGER,
        format TEXT,
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

    // Ensure default user exists if table is empty
    const usersCount = db.prepare('SELECT count(*) as count FROM users').get() as any;
    if (usersCount.count === 0) {
      db.prepare('INSERT INTO users (id, username, displayName) VALUES (?, ?, ?)').run('1', 'admin', 'Master Architect');
    }
    logToFile('logs/service_log.txt', 'Database tables initialized.');

    app.use(express.json());

    // Serve static assets (covers, books)
    app.use('/data', express.static(path.join(process.cwd(), 'data')));

    // --- API ROUTES ---
    logToFile('logs/service_log.txt', 'Setting up API routes...');

  // Auth - Simplified for now
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (user) {
      res.json({ token: 'mock-token', user });
    } else {
      // Default to the first user if not found for mock purpose
      const defaultUser = db.prepare('SELECT * FROM users LIMIT 1').get() as any;
      res.json({ token: 'mock-token', user: defaultUser });
    }
  });

  // Users (Profiles)
  app.get('/api/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    res.json(users);
  });

  app.post('/api/users', (req, res) => {
    const { username, displayName } = req.body;
    const id = randomUUID();
    try {
      db.prepare('INSERT INTO users (id, username, displayName) VALUES (?, ?, ?)').run(id, username, displayName);
      res.json({ success: true, user: { id, username, displayName } });
    } catch (e) {
      res.status(400).json({ error: 'username-taken' });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    if (id === '1') return res.status(403).json({ error: 'cannot-delete-master' });
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.prepare('DELETE FROM sync_data WHERE userId = ?').run(id);
    res.json({ success: true });
  });

  // Search within book (Intra-Document Forensics)
  app.get('/api/books/:id/search', (req, res) => {
    const { id } = req.params;
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'query-required' });
    
    const book = db.prepare('SELECT filePath, format, title FROM books WHERE id = ?').get(id) as any;
    if (!book || !fs.existsSync(book.filePath)) return res.status(404).json({ error: 'not-found' });
    
    if (book.format === 'epub') {
      try {
        const zip = new AdmZip(book.filePath);
        const results: any[] = [];
        zip.getEntries().forEach(entry => {
          if (entry.entryName.match(/\.(html|xhtml|xml)$/i) && !entry.entryName.includes('cover') && !entry.entryName.includes('style')) {
            const content = zip.readAsText(entry);
            const lowerContent = content.toLowerCase();
            const lowerQuery = (q as string).toLowerCase();
            
            let pos = lowerContent.indexOf(lowerQuery);
            while (pos !== -1) {
              const start = Math.max(0, pos - 60);
              const end = Math.min(content.length, pos + lowerQuery.length + 60);
              const rawSnippet = content.substring(start, end);
              // Clean HTML tags for snippet
              const cleanSnippet = rawSnippet.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              
              results.push({ 
                chapter: entry.entryName, 
                snippet: cleanSnippet,
                offset: pos 
              });
              
              if (results.length >= 50) break;
              pos = lowerContent.indexOf(lowerQuery, pos + lowerQuery.length);
            }
          }
          if (results.length >= 50) return;
        });
        res.json({ bookTitle: book.title, results });
      } catch (e) {
        res.status(500).json({ error: 'extraction-failed' });
      }
    } else {
      res.status(400).json({ error: 'unsupported-format', message: 'Intra-Document Forensics is currently optimized for EPUB architecture.' });
    }
  });

  // Serve book files for local reader
  app.get('/api/books/:id/file', (req, res) => {
    const { id } = req.params;
    const book = db.prepare('SELECT filePath FROM books WHERE id = ?').get(id) as any;
    if (book && fs.existsSync(book.filePath)) {
      res.sendFile(book.filePath);
    } else {
      res.status(404).send('File not found');
    }
  });

  // Library Scan
  app.post('/api/library/scan', async (req, res) => {
    const libraryPathRaw = db.prepare('SELECT value FROM settings WHERE key = ?').get('library_path') as any;
    const libraryPath = libraryPathRaw ? libraryPathRaw.value : null;

    if (!libraryPath || !fs.existsSync(libraryPath)) {
      return res.status(400).json({ error: 'invalid-path', message: 'Library path not set or invalid.' });
    }

    const coversDir = path.join(process.cwd(), 'data', 'covers');
    if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });

    logToFile('logs/service_log.txt', `Starting library scan at: ${libraryPath}`);
    
    const scanDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (file.match(/\.(epub|pdf|mobi|azw3)$/i)) {
          const stats = fs.statSync(fullPath);
          const md5 = createHash('md5').update(fullPath).digest('hex');
          const coverTxtPath = path.join(coversDir, `${md5}.txt`);
          
          const fallbackId = path.basename(file, path.extname(file));
          let coverPath = '';
          let ebookTitle = fallbackId;
          let ebookAuthor = 'Unknown';
          let ebookDesc = '';
          let ebookPub = '';
          let ebookDate = '';
          let ebookLang = '';

          // Extraction logic
          try {
            if (file.toLowerCase().endsWith('.epub')) {
              const zip = new AdmZip(fullPath);
              const zipEntries = zip.getEntries();
              
              // 1. Extract Cover
              const coverEntry = zipEntries.find(e => e.entryName.toLowerCase().includes('cover') && e.entryName.match(/\.(jpg|jpeg|png)$/i));
              if (coverEntry) {
                 const base64 = zip.readFile(coverEntry).toString('base64');
                 fs.writeFileSync(coverTxtPath, `data:image/jpeg;base64,${base64}`);
                 coverPath = `/api/covers/${md5}`;
              }

              // 2. Extract Metadata from OPF
              const containerEntry = zipEntries.find(e => e.entryName === 'META-INF/container.xml');
              if (containerEntry) {
                const containerXml = zip.readAsText(containerEntry);
                const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
                if (opfPathMatch) {
                  const opfEntry = zipEntries.find(e => e.entryName === opfPathMatch[1]);
                  if (opfEntry) {
                    const opfXml = zip.readAsText(opfEntry);
                    
                    const getMeta = (tag: string) => {
                      const match = opfXml.match(new RegExp(`<dc:${tag}[^>]*>([^<]+)</dc:${tag}>`, 'i'));
                      return match ? match[1].trim() : '';
                    };

                    ebookTitle = getMeta('title') || ebookTitle;
                    ebookAuthor = getMeta('creator') || ebookAuthor;
                    ebookDesc = getMeta('description') || '';
                    ebookPub = getMeta('publisher') || '';
                    ebookDate = getMeta('date') || '';
                    ebookLang = getMeta('language') || '';
                    
                    const ebookSubject = getMeta('subject') || '';
                    
                    // Basic HTML tag removal for description
                    ebookDesc = ebookDesc.replace(/<[^>]*>/g, '');

                    const exists = db.prepare('SELECT id FROM books WHERE filePath = ?').get(fullPath);
                    if (!exists) {
                      db.prepare(`
                        INSERT INTO books (id, title, author, description, publisher, publishedDate, language, subject, filePath, coverPath, size, format, status) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                      `).run(randomUUID(), ebookTitle, ebookAuthor, ebookDesc, ebookPub, ebookDate, ebookLang, ebookSubject, fullPath, coverPath, stats.size, path.extname(file).slice(1), 'library');
                      logToFile('logs/service_log.txt', `Indexed new book: ${ebookTitle} by ${ebookAuthor}`);
                    }
                  }
                }
              }
            }
          } catch (e) {
            logToFile('logs/service_log.txt', `Meta extraction failed for ${file}: ${e}`);
          }
        }
      }
    };

    try {
      scanDir(libraryPath);
      res.json({ success: true, message: 'Scan completed.' });
    } catch (e: any) {
      logToFile('logs/service_log.txt', `Scan error: ${e.message}`);
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

  // Cover serving
  app.get('/api/covers/:md5', (req, res) => {
    const { md5 } = req.params;
    const p = path.join(process.cwd(), 'data', 'covers', `${md5}.txt`);
    if (fs.existsSync(p)) {
      res.send(fs.readFileSync(p, 'utf8'));
    } else {
      res.status(404).send('Not found');
    }
  });

  // System Update
  app.get('/api/system/update/check', async (req, res) => {
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(pkgPath)) {
        return res.json({ updateAvailable: false, message: 'Package manifest missing' });
      }
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const currentVersion = pkg.version;
      
      const githubRes = await fetch('https://api.github.com/repos/FoxWilder/KOReader-Sync-Dashboard/releases/latest', {
        headers: { 'User-Agent': 'WilderSync-Updater' }
      });
      
      if (!githubRes.ok) throw new Error(`GitHub API returned ${githubRes.status}`);
      
      const latest = await githubRes.json() as any;
      const latestTag = latest.tag_name?.replace('v', '') || '0.0.0';
      const currentVerClean = currentVersion.replace('v', '');
      
      res.json({
        latestVersion: latest.tag_name,
        currentVersion,
        updateAvailable: latestTag !== currentVerClean,
        releaseNotes: latest.body || 'No release notes available.'
      });
    } catch (e: any) {
      logToFile('logs/service_log.txt', `Update check failed: ${e.message}`);
      res.status(500).json({ error: 'update-check-failed', details: e.message });
    }
  });

  app.post('/api/system/update/apply', (req, res) => {
    logToFile('logs/service_log.txt', 'WEB-UPDATE: Initiating fully automated update via install.ps1');
    
    // Launch a detached process to handle the update
    const installerCommand = `iwr -useb https://raw.githubusercontent.com/FoxWilder/KOReader-Sync-Dashboard/main/install.ps1 | iex`;
    const spawnCommand = `Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command \`"${installerCommand}\`"" -WindowStyle Normal`;
    
    try {
      require('child_process').exec(`powershell -Command "${spawnCommand}"`);
      res.json({ 
        success: true, 
        message: 'Update initiated. A new PowerShell window has been launched on the server to perform the update. This dashboard will go offline momentarily.' 
      });
    } catch (e) {
      logToFile('logs/service_log.txt', `Update launch failed: ${e}`);
      res.status(500).json({ error: 'Update failed to launch' });
    }
  });

  // News Feed
  app.get('/api/news', async (req, res) => {
    try {
      const customReposRaw = db.prepare('SELECT value FROM settings WHERE key = ?').get('news_repos') as any;
      const customRepos = customReposRaw ? JSON.parse(customReposRaw.value) : [];
      
      const defaultRepos = [
        'koreader/koreader',
        'franssjz/cpr-vcodex'
      ];
      
      const allRepos = Array.from(new Set([...defaultRepos, ...customRepos]));
      const newsFeed = [];

      for (const repo of allRepos) {
        try {
          const githubRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
            headers: { 'User-Agent': 'WilderSync' }
          });
          const releases = await githubRes.json() as any[];
          if (Array.isArray(releases) && releases.length > 0) {
            newsFeed.push({
              repo,
              latest: releases[0]
            });
          }
        } catch (e) {
          console.error(`Failed to fetch releases for ${repo}:`, e);
        }
      }
      
      res.json(newsFeed);
    } catch (e) {
      res.status(500).json({ error: 'news-fetch-failed' });
    }
  });

  app.post('/api/news/repos', (req, res) => {
    const { repo } = req.body;
    if (!repo) return res.status(400).json({ error: 'repo-required' });
    
    const currentRaw = db.prepare('SELECT value FROM settings WHERE key = ?').get('news_repos') as any;
    let repos = currentRaw ? JSON.parse(currentRaw.value) : [];
    if (!repos.includes(repo)) {
      repos.push(repo);
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('news_repos', JSON.stringify(repos));
    }
    res.json({ success: true, repos });
  });

  app.delete('/api/news/repos', (req, res) => {
    const { repo } = req.body;
    const currentRaw = db.prepare('SELECT value FROM settings WHERE key = ?').get('news_repos') as any;
    if (currentRaw) {
      let repos = JSON.parse(currentRaw.value);
      repos = repos.filter((r: string) => r !== repo);
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('news_repos', JSON.stringify(repos));
    }
    res.json({ success: true });
  });

  // Shortened Sync Route for KOReader
  app.use('/sync', (req, res, next) => {
    req.url = '/koreader/sync/v1' + req.url;
    next();
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
    const { status, isReading, progress, aiSector } = req.body;
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (status !== undefined) { 
      updates.push('status = ?'); 
      params.push(status);
      // Auto-set isReading based on status
      updates.push('isReading = ?');
      params.push(status === 'reading' ? 1 : 0);
    } else {
      if (isReading !== undefined) { 
        updates.push('isReading = ?'); 
        params.push(isReading ? 1 : 0); 
      }
    }
    if (progress !== undefined) { updates.push('progress = ?'); params.push(progress); }
    if (aiSector !== undefined) { updates.push('aiSector = ?'); params.push(aiSector); }
    
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
    const uniqueAuthors = db.prepare('SELECT count(DISTINCT author) as count FROM books').get() as any;
    const formats = db.prepare('SELECT format, count(*) as count FROM books GROUP BY format').all() as any[];
    const totalSize = db.prepare('SELECT sum(size) as sum FROM books').get() as any;
    const categories = db.prepare('SELECT count(DISTINCT subject) as count FROM books WHERE subject IS NOT NULL AND subject != ""').get() as any;
    
    res.json({
      total: totalBooks.count,
      reading: readingBooks.count,
      completed: completedBooks.count,
      authors: uniqueAuthors.count,
      formats: formats,
      size: totalSize.sum || 0,
      categories: categories.count,
      uptime: process.uptime()
    });
  });

  // KOReader Sync Protocol Endpoints (Full compatibility with koreader-sync-server)
  
  // Handshake / Auth
  app.get(['/koreader/sync/v1/auth', '/koreader-sync-v1/auth', '/users/auth'], (req, res) => {
    logToFile('logs/sync_log.txt', `AUTH Handshake: ${req.headers.authorization ? 'Credentials provided' : 'No credentials'}`);
    res.status(200).send('OK');
  });

  // Get progress
  app.get(['/koreader/sync/v1/progress/:documentId', '/koreader-sync-v1/progress/:documentId', '/koreader-sync-v1/progress'], (req, res) => {
    // Some KOReader clients might send it in query or as a path
    const documentId = req.params.documentId || req.query.document_id || req.query.documentId;
    
    if (!documentId) {
       return res.status(400).json({ error: 'documentId required' });
    }

    const userId = '1';
    const data = db.prepare('SELECT progress FROM sync_data WHERE userId = ? AND documentId = ?').get(userId, documentId) as any;
    
    if (data) {
      logToFile('logs/sync_log.txt', `GET Progress for ${documentId}: Data found`);
      res.json(JSON.parse(data.progress));
    } else {
      logToFile('logs/sync_log.txt', `GET Progress for ${documentId}: Not found`);
      res.status(404).json({ error: 'not found' });
    }
  });

  // Update progress (Prefer PUT, allow POST for maximum compatibility)
  const handleProgressUpdate = (req: express.Request, res: express.Response) => {
    const { documentId } = req.params;
    const { progress, timestamp, document_id } = req.body;
    
    // Priorities: Path Param > Body document_id > Query document_id
    const finalDocId = documentId || document_id || req.query.document_id;
    const userId = '1';

    if (!finalDocId) {
      logToFile('logs/sync_log.txt', `UPDATE Progress FAILED: Missing documentId. Body: ${JSON.stringify(req.body)}`);
      return res.status(400).json({ error: 'documentId required' });
    }

    // koreader-sync-server usually sends the progress directly in the body OR as a sub-object
    let normalizedProgress = progress;
    if (!normalizedProgress && (req.body.xpointer || req.body.percentage)) {
      normalizedProgress = req.body;
    }

    if (!normalizedProgress) {
       logToFile('logs/sync_log.txt', `UPDATE Progress FAILED for ${finalDocId}: No progress data in body`);
       return res.status(400).json({ error: 'progress data required' });
    }

    db.prepare(`
      INSERT INTO sync_data (userId, documentId, progress, timestamp) 
      VALUES (?, ?, ?, ?)
      ON CONFLICT(userId, documentId) DO UPDATE SET 
        progress = excluded.progress,
        timestamp = excluded.timestamp
    `).run(userId, finalDocId, JSON.stringify(normalizedProgress), timestamp || Math.floor(Date.now() / 1000));

    logToFile('logs/sync_log.txt', `UPDATE Progress for ${finalDocId}: Success`);
    res.json({ status: 'ok' });
  };

  app.put(['/koreader/sync/v1/progress/:documentId', '/koreader-sync-v1/progress/:documentId', '/koreader-sync-v1/progress'], handleProgressUpdate);
  app.post(['/koreader/sync/v1/progress', '/koreader-sync-v1/progress', '/koreader/sync/v1/progress'], handleProgressUpdate);
  app.post(['/koreader/sync/v1/progress/:documentId', '/koreader-sync-v1/progress/:documentId'], handleProgressUpdate);
  app.patch(['/koreader/sync/v1/progress/:documentId', '/koreader-sync-v1/progress/:documentId'], handleProgressUpdate);


  // Vite middleware for development
  if (!isProd) {
    logToFile('logs/service_log.txt', 'Initializing Vite middleware...');
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      logToFile('logs/service_log.txt', 'Vite middleware initialized.');
    } catch (e) {
      logToFile('logs/service_log.txt', `ERROR: Vite failed to start: ${e}`);
      console.error('Vite failed to start:', e);
    }
  } else {
    logToFile('logs/service_log.txt', 'Serving production build from dist/');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  } catch (err) {
    logToFile('logs/service_log.txt', `CRITICAL ERROR during startup: ${err}`);
    console.error('Critical boot error:', err);
    process.exit(1);
  }
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
