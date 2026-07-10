const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;

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

// Proxy for Downloader API
if (process.env.VITE_DOWNLOADER_API_URL) {
  app.use('/api/downloader', createProxyMiddleware({
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
    VITE_DOWNLOADER_PASSWORD: process.env.VITE_DOWNLOADER_PASSWORD || 'admin'
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
