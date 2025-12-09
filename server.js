const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const HOST = '0.0.0.0';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const loginCompletePage = `
<!DOCTYPE html>
<html>
<head>
  <title>SpankBang Login Complete</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
    }
    .container {
      padding: 40px;
      background: rgba(255,255,255,0.1);
      border-radius: 20px;
      max-width: 400px;
    }
    .checkmark {
      font-size: 80px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0 0 15px 0;
      font-size: 24px;
    }
    p {
      margin: 0;
      opacity: 0.8;
      font-size: 16px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">✓</div>
    <h1>Login Complete!</h1>
    <p>Grayjay should close this window automatically now.<br><br>If not, you can close this window manually and return to Grayjay.</p>
  </div>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  // Special login complete page
  if (req.url === '/login-complete' || req.url === '/login-complete/') {
    res.writeHead(200, { 
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(loginCompletePage, 'utf-8');
    return;
  }

  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        res.end('File not found', 'utf-8');
      } else {
        res.writeHead(500, { 
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        res.end('Server error: ' + error.code, 'utf-8');
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Grayjay Plugin Server running at http://${HOST}:${PORT}/`);
  console.log(`Plugin config: http://${HOST}:${PORT}/SpankbangConfig.json`);
  console.log(`Plugin script: http://${HOST}:${PORT}/SpankbangScript.js`);
  console.log(`Login complete page: http://${HOST}:${PORT}/login-complete`);
});
