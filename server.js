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

const loginPage = `
<!DOCTYPE html>
<html>
<head>
  <title>SpankBang Login</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .container {
      width: 100%;
      max-width: 350px;
      text-align: center;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 10px 0;
    }
    p {
      font-size: 14px;
      opacity: 0.8;
      margin: 0 0 25px 0;
      line-height: 1.4;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 16px 20px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 12px;
      transition: transform 0.1s, opacity 0.2s;
    }
    .btn:active { transform: scale(0.98); }
    .btn-primary {
      background: #e74c3c;
      color: white;
    }
    .btn-success {
      background: #27ae60;
      color: white;
    }
    .step {
      display: flex;
      align-items: center;
      text-align: left;
      margin-bottom: 15px;
      padding: 12px;
      background: rgba(255,255,255,0.1);
      border-radius: 10px;
    }
    .step-num {
      width: 28px;
      height: 28px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .step-text {
      font-size: 14px;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>SpankBang Login</h1>
    <p>Follow these steps to connect your account:</p>
    
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-text">Tap the button below to open SpankBang and log in</div>
    </div>
    
    <a href="https://www.spankbang.com/users/login" class="btn btn-primary" target="_blank">
      Open SpankBang Login
    </a>
    
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-text">After logging in, come back here and tap "Done"</div>
    </div>
    
    <a href="/login-complete" class="btn btn-success">
      Done - I'm Logged In
    </a>
  </div>
</body>
</html>
`;

const loginCompletePage = `
<!DOCTYPE html>
<html>
<head>
  <title>Login Complete</title>
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
      max-width: 350px;
    }
    .checkmark {
      font-size: 70px;
      margin-bottom: 15px;
    }
    h1 {
      margin: 0 0 12px 0;
      font-size: 22px;
    }
    p {
      margin: 0;
      opacity: 0.8;
      font-size: 14px;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">✓</div>
    <h1>Login Complete!</h1>
    <p>Grayjay will close this window automatically. If it doesn't close in a few seconds, you can close it manually.</p>
  </div>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  
  if (url === '/login' || url === '/login/') {
    res.writeHead(200, { 
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(loginPage, 'utf-8');
    return;
  }
  
  if (url === '/login-complete' || url === '/login-complete/') {
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
  console.log(`Login page: http://${HOST}:${PORT}/login`);
});
