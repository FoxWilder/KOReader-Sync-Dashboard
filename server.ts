import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import multer from 'multer';
import Database from 'better-sqlite3';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const db = new Database('sake.db');

  // Initialize DB tables
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

  app.use(express.json());

  // Serve static assets (covers, books)
  app.use('/data', express.static(path.join(process.cwd(), 'data')));

  // --- API ROUTES ---

  // Auth - Simplified for now
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    // Mock user for now
    res.json({ token: 'mock-token', user: { id: '1', username: 'admin' } });
  });

  // Library
  app.get('/api/books', (req, res) => {
    const books = db.prepare('SELECT * FROM books ORDER BY createdAt DESC').all();
    res.json(books);
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
