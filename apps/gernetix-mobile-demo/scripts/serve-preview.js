const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const host = '0.0.0.0';
const port = Number.parseInt(process.env.GERNETIX_MOBILE_PREVIEW_PORT || '8082', 10);
const root = path.resolve(__dirname, '..', 'dist-web');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const candidate = path.resolve(root, relativePath);

  if (!candidate.startsWith(`${root}${path.sep}`) && candidate !== root) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(candidate, (error, contents) => {
    if (error) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes[path.extname(candidate)] || 'application/octet-stream',
    });
    response.end(contents);
  });
});

server.listen(port, host, () => {
  console.log(`GerNetiX mobile preview: http://${host}:${port}`);
});
