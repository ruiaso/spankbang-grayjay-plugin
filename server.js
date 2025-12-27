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
  <title>SpankBang Cookie Setup</title>
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
      max-width: 500px;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 10px 0;
      text-align: center;
    }
    .info-box {
      background: rgba(255, 193, 7, 0.15);
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
    }
    .step {
      background: rgba(255,255,255,0.08);
      padding: 15px;
      margin-bottom: 12px;
      border-radius: 10px;
      font-size: 14px;
      line-height: 1.5;
    }
    .step-title {
      font-weight: 700;
      color: #4FC3F7;
      margin-bottom: 8px;
      font-size: 15px;
    }
    .step-content {
      color: rgba(255,255,255,0.9);
    }
    .code {
      background: rgba(0,0,0,0.3);
      padding: 8px 12px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      margin: 8px 0;
      word-break: break-all;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 20px;
      font-size: 15px;
      font-weight: 600;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      text-decoration: none;
      text-align: center;
      margin-bottom: 10px;
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
    .warning {
      color: #ffc107;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🍪 SpankBang Authentication Setup</h1>
    
    <div class="info-box">
      <strong>⚠️ Why Manual Cookies?</strong><br>
      SpankBang uses JavaScript-based authentication that Grayjay plugins cannot automate. 
      You need to manually extract your browser cookies after logging in.
    </div>

    <div class="step">
      <div class="step-title">Step 1: Login to SpankBang</div>
      <div class="step-content">
        Open SpankBang in your browser and log in to your account normally.
        <a href="https://spankbang.com/users/login" class="btn btn-primary" target="_blank" style="margin-top: 10px;">
          Open SpankBang Login
        </a>
      </div>
    </div>

    <div class="step">
      <div class="step-title">Step 2: Open Browser Developer Tools</div>
      <div class="step-content">
        <strong>Chrome/Edge:</strong> Press F12 or Ctrl+Shift+I (Cmd+Option+I on Mac)<br>
        <strong>Firefox:</strong> Press F12 or Ctrl+Shift+I (Cmd+Option+I on Mac)<br>
        <strong>Safari:</strong> Enable Developer Menu first, then press Cmd+Option+I
      </div>
    </div>

    <div class="step">
      <div class="step-title">Step 3: Go to Application/Storage Tab</div>
      <div class="step-content">
        • In <strong>Chrome/Edge</strong>: Click "Application" tab → Cookies → spankbang.com<br>
        • In <strong>Firefox</strong>: Click "Storage" tab → Cookies → https://spankbang.com<br>
        • In <strong>Safari</strong>: Click "Storage" tab → Cookies → spankbang.com
      </div>
    </div>

    <div class="step">
      <div class="step-title">Step 4: Copy Cookie Values</div>
      <div class="step-content">
        Look for cookies named: <code class="code">auth</code>, <code class="code">session</code>, or <code class="code">sid</code><br><br>
        Format them as:<br>
        <div class="code">auth=YOUR_AUTH_VALUE; session=YOUR_SESSION_VALUE</div>
        <br>
        <span class="warning">Important:</span> Copy the entire cookie string with all values separated by semicolons.
      </div>
    </div>

    <div class="step">
      <div class="step-title">Step 5: Configure in Grayjay</div>
      <div class="step-content">
        1. Go back to Grayjay app<br>
        2. Open this plugin's settings<br>
        3. Find "Authentication Cookies" setting<br>
        4. Paste your cookie string<br>
        5. Save settings
      </div>
    </div>

    <div class="info-box">
      <strong>🔒 Privacy Note:</strong><br>
      Your cookies are stored only on your device and are used solely to authenticate your requests to SpankBang. 
      Cookies typically expire after 30 days - you'll need to repeat this process when they expire.
    </div>

    <a href="javascript:window.close()" class="btn btn-success">
      Done - Close This Window
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
