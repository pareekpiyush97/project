// minimal static file server for local preview
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, PORT = Number(process.env.PORT) || 4970;
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml',
  '.webp':'image/webp', '.woff2':'font/woff2', '.json':'application/json',
  '.mp4':'video/mp4', '.webm':'video/webm', '.txt':'text/plain', '.ico':'image/x-icon' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('404'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const base = { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };

    /* Byte ranges, because without them a <video> reports seekable = [0,0] and
       currentTime assignments are silently ignored — the preview would behave
       differently from the host it is meant to stand in for, and you would go
       looking for the bug in the page. */
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : NaN;
      let end = m[2] ? parseInt(m[2], 10) : NaN;
      if (Number.isNaN(start)) { start = st.size - end; end = st.size - 1; }   // suffix range
      if (Number.isNaN(end)) end = st.size - 1;
      if (start > end || start < 0 || end >= st.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        return res.end();
      }
      res.writeHead(206, Object.assign({}, base, {
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Content-Length': end - start + 1
      }));
      return fs.createReadStream(file, { start, end }).pipe(res);
    }

    res.writeHead(200, Object.assign({}, base, { 'Content-Length': st.size }));
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log('Z Lab preview on http://localhost:' + PORT));
