// minimal static file server for local preview
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, PORT = 4970;
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml',
  '.mp4':'video/mp4', '.webm':'video/webm', '.txt':'text/plain', '.ico':'image/x-icon' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, () => console.log('Z Lab preview on http://localhost:' + PORT));
