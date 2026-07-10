const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 80;
const JWT_SECRET = process.env.JWT_SECRET || process.env.VITE_DOWNLOADER_PASSWORD || 'admin-secret';
const rateLimits = new Map();

app.use(express.json()); // To parse JSON bodies for login endpoint

// Serve static files from the Vite build directory
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Authentication Endpoint
app.post('/api/downloader/auth/login', (req, res) => {
  const ip = req.ip;
  const now = Date.now();
  
  if (rateLimits.has(ip)) {
    const limit = rateLimits.get(ip);
    if (limit.lockUntil > now) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
  }

  const { password } = req.body;
  const expectedPassword = process.env.VITE_DOWNLOADER_PASSWORD || 'admin';

  if (password === expectedPassword) {
    rateLimits.delete(ip);
    const token = jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: '30m' });
    return res.json({ token });
  } else {
    const limit = rateLimits.get(ip) || { attempts: 0, lockUntil: 0 };
    limit.attempts += 1;
    if (limit.attempts >= 5) {
      limit.lockUntil = now + 5 * 60 * 1000; // 5 minutes
      limit.attempts = 0;
    }
    rateLimits.set(ip, limit);
    return res.status(401).json({ error: 'Incorrect password' });
  }
});

// Middleware for Downloader API
const requireDownloaderAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized or token expired' });
  }
};

// Proxy for Downloader API
if (process.env.VITE_DOWNLOADER_API_URL) {
  app.use('/api/downloader', requireDownloaderAuth, createProxyMiddleware({
    target: process.env.VITE_DOWNLOADER_API_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/downloader': '', // Remove the /api/downloader prefix before sending to backend
    },
    logLevel: 'info'
  }));
} else {
  console.warn('WARNING: VITE_DOWNLOADER_API_URL is not set. Downloader proxy is inactive.');
}

// Proxy for YouTube Music API (replacing the previous nginx rule)
app.use('/api/ytm', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true, // proxy websockets (upgrade header)
  logLevel: 'info'
}));

// Serve runtime environment variables to the frontend
app.get('/api/env.js', (req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(`window.__RUNTIME_ENV__ = ${JSON.stringify({
    // VITE_DOWNLOADER_PASSWORD removed for security
  })};`);
});

// SPA Fallback: Any other request should serve index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
