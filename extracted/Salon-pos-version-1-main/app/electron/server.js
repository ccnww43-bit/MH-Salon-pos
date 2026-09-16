const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

// The app's database (IndexedDB) and settings (localStorage) are tied to
// the exact "http://127.0.0.1:PORT" address the app loads. If the port
// changes between launches, the browser engine treats it as a completely
// different app and the old data becomes invisible. These ports are fixed
// on purpose so the same data is there every time the app is opened.
const PREFERRED_PORTS = [47823, 47824, 47825, 47826, 47827];

function resolveFilePath(outDir, urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);

  if (cleanPath === '/') {
    return path.join(outDir, 'index.html');
  }

  const relative = cleanPath.replace(/^\/+/, '');
  const direct = path.join(outDir, relative);

  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
    return direct;
  }

  const asIndex = path.join(outDir, relative, 'index.html');
  if (fs.existsSync(asIndex)) {
    return asIndex;
  }

  const asHtml = `${direct}.html`;
  if (fs.existsSync(asHtml)) {
    return asHtml;
  }

  return null;
}

function createServer(outDir) {
  return http.createServer((req, res) => {
    const filePath = resolveFilePath(outDir, req.url || '/');

    if (!filePath) {
      const fallback = path.join(outDir, 'index.html');
      fs.readFile(fallback, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
}

// Tries each fixed port in order, so the app's data address stays the same
// across restarts on a normal machine. Only if every one of those is
// already taken (extremely unlikely) does it fall back to a random port
// for that single session, so the app can still open rather than crash.
function startServer(outDir = path.join(__dirname, '..', '..', 'out')) {
  return new Promise((resolve, reject) => {
    const tryPort = (index) => {
      const server = createServer(outDir);

      const onError = (err) => {
        server.removeListener('error', onError);
        if (err.code === 'EADDRINUSE' && index < PREFERRED_PORTS.length - 1) {
          tryPort(index + 1);
          return;
        }
        if (err.code === 'EADDRINUSE') {
          // Last resort: any free port, for this session only.
          const fallback = createServer(outDir);
          fallback.on('error', reject);
          fallback.listen(0, '127.0.0.1', () => {
            resolve(fallback.address().port);
          });
          return;
        }
        reject(err);
      };

      server.on('error', onError);
      server.listen(PREFERRED_PORTS[index], '127.0.0.1', () => {
        server.removeListener('error', onError);
        resolve(PREFERRED_PORTS[index]);
      });
    };

    tryPort(0);
  });
}

module.exports = { startServer };
