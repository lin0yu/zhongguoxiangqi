/**
 * 轻量内网服务端（Node原生http）
 * 功能：RBAC登录、IP白名单与MAC绑定校验、静态文件服务、访问日志与异常告警、错误与性能上报接口。
 * 说明：无外部依赖，MAC绑定通过解析系统ARP表实现（同网段有效）。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const { exec } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PUB = ROOT; // 静态目录为项目根（打包后从快照中读取）
// 配置文件优先从工作目录加载，未找到则回退到内置快照
const CFG_DISK_PATH = path.join(process.cwd(), 'server', 'config.json');
const CFG_EMBED_PATH = path.join(__dirname, 'config.json');
// 日志目录写入工作目录，避免打包后写入快照失败
const LOG_DIR = path.join(process.cwd(), 'server', 'logs');
const ACCESS_LOG = path.join(LOG_DIR, 'access.log');
const SECURITY_LOG = path.join(LOG_DIR, 'security.log');

/** 加载配置并提供更新 */
/**
 * 加载配置（支持打包快照与外部文件）
 *
 * 优先读取工作目录 `server/config.json`，不存在时回退到内置配置。
 * 任何异常均记录到控制台并返回安全默认值。
 */
function loadConfig() {
  try {
    if (fs.existsSync(CFG_DISK_PATH)) {
      return JSON.parse(fs.readFileSync(CFG_DISK_PATH, 'utf8'));
    }
    return JSON.parse(fs.readFileSync(CFG_EMBED_PATH, 'utf8'));
  } catch (e) {
    console.error('Config load failed', e);
    return {
      users: [],
      ipWhitelist: [],
      macWhitelist: [],
      ipWhitelistEnabled: false,
      macWhitelistEnabled: false,
      serverHost: '0.0.0.0',
      serverPort: 8080,
      security: { failedLoginAlertThreshold: 5, sessionSecret: 'secret', sessionMaxAgeMs: 86400000 }
    };
  }
}
let CONFIG = loadConfig();
function reloadConfig() { CONFIG = loadConfig(); }

/** 确保日志目录 */
try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR); } catch (e) {}

/** 简单日志写入（附基本错误处理） */
function writeLog(file, line) {
  try { fs.appendFileSync(file, line + '\n'); } catch (e) { console.error('Log write failed', e); }
}

/** 获取客户端IP（适配代理头） */
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  const ip = (xff && xff.split(',')[0].trim()) || req.socket.remoteAddress || '';
  return ip.replace('::ffff:', '');
}

/** 解析ARP以获取目标IP的MAC（Windows格式） */
function getMacByIpWin(ip) {
  return new Promise((resolve) => {
    exec('arp -a', { timeout: 2000 }, (err, stdout) => {
      if (err) { resolve(null); return; }
      const lines = stdout.split(/\r?\n/);
      for (const line of lines) {
        if (line.includes(ip)) {
          const parts = line.trim().split(/\s+/);
          // Windows arp -a: IP Address       Physical Address     Type
          if (parts.length >= 2) {
            const mac = parts[1];
            resolve(mac.toUpperCase());
            return;
          }
        }
      }
      resolve(null);
    });
  });
}

/** Cookie处理 */
function parseCookies(cookie) {
  const out = {}; if (!cookie) return out;
  cookie.split(';').forEach(p => { const [k, v] = p.trim().split('='); out[k] = decodeURIComponent(v || ''); });
  return out;
}
function setCookie(res, name, value, maxAgeMs) {
  const expires = new Date(Date.now() + (maxAgeMs || CONFIG.security.sessionMaxAgeMs)).toUTCString();
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Expires=${expires}; HttpOnly; Path=/`);
}

/** 会话签名（简易HMAC） */
function signSession(payload) {
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', CONFIG.security.sessionSecret).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64');
}
function verifySession(token) {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const { data, sig } = JSON.parse(raw);
    const expect = crypto.createHmac('sha256', CONFIG.security.sessionSecret).update(data).digest('hex');
    if (expect !== sig) return null;
    return JSON.parse(data);
  } catch (e) { return null; }
}

/** 权限校验：IP与MAC白名单 */
async function checkNetworkAccess(req) {
  const ip = getClientIp(req);
  const ipOk = CONFIG.ipWhitelist.includes(ip);
  let macOk = false;
  let mac = null;
  try { mac = await getMacByIpWin(ip); } catch (e) {}
  if (mac) macOk = CONFIG.macWhitelist.includes(mac);
  const ipEnabled = !!CONFIG.ipWhitelistEnabled;
  const macEnabled = !!CONFIG.macWhitelistEnabled;
  return { ip, mac, ipOk, macOk, pass: (!ipEnabled || ipOk) && (!macEnabled || macOk) };
}

/** 登录失败计数与告警 */
const failedLogin = new Map(); // key: ip
function recordFailedLogin(ip) {
  const count = (failedLogin.get(ip) || 0) + 1;
  failedLogin.set(ip, count);
  if (count >= CONFIG.security.failedLoginAlertThreshold) {
    writeLog(SECURITY_LOG, `[ALERT] Too many failed logins from ${ip}, count=${count}`);
  }
}
function clearFailedLogin(ip) { failedLogin.delete(ip); }

/** 简易静态文件服务 */
function ctype(p) {
  const e = path.extname(p).toLowerCase();
  return e === '.html' ? 'text/html' : e === '.css' ? 'text/css' : e === '.js' ? 'application/javascript' : e === '.json' ? 'application/json' : e === '.png' ? 'image/png' : e === '.jpg' || e === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
}

/** 路由分发 */
async function handle(req, res) {
  const now = new Date().toISOString();
  try {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname || '/';
    const method = req.method || 'GET';
    const ip = getClientIp(req);
    writeLog(ACCESS_LOG, `${now} ${ip} ${method} ${pathname}`);

    // API: 登录
    if (pathname === '/api/login' && method === 'POST') {
      const chunks = [];
      req.on('data', b => chunks.push(b));
      req.on('end', async () => {
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        const { username, password } = body;

        const net = await checkNetworkAccess(req);
        if (!net.pass) {
          writeLog(SECURITY_LOG, `[DENY] IP/MAC failed ip=${net.ip} mac=${net.mac}`);
          res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, code: 'SEC_DENY', message: 'IP或MAC未授权' }));
          return;
        }

        const user = CONFIG.users.find(u => u.username === username && u.password === password);
        if (!user) {
          recordFailedLogin(ip);
          res.statusCode = 401; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, code: 'AUTH_FAIL', message: '用户名或密码错误' }));
          return;
        }

        clearFailedLogin(ip);
        const session = { username: user.username, role: user.role, ip, iat: Date.now() };
        const token = signSession(session);
        setCookie(res, 'SESSION', token, CONFIG.security.sessionMaxAgeMs);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, role: user.role }));
      });
      return;
    }

    // API: 会话校验
    if (pathname === '/api/session' && method === 'GET') {
      const ck = parseCookies(req.headers['cookie']);
      const sess = ck.SESSION ? verifySession(ck.SESSION) : null;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: !!sess, session: sess || null }));
      return;
    }

    // API: 错误与性能上报
    if ((pathname === '/api/report/error' || pathname === '/api/report/perf') && method === 'POST') {
      const chunks = []; req.on('data', b => chunks.push(b));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        const file = pathname.includes('/error') ? SECURITY_LOG : ACCESS_LOG;
        writeLog(file, `[REPORT] ${now} ${ip} ${body}`);
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    // 静态文件
    let reqPath = pathname;
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(PUB, reqPath);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.statusCode = 404; res.end('Not Found'); }
      else { res.setHeader('Content-Type', ctype(filePath)); res.end(data); }
    });
  } catch (e) {
    writeLog(SECURITY_LOG, `[ERROR] ${now} ${e.stack || e}`);
    res.statusCode = 500; res.end('Server Error');
  }
}

/**
 * 启动服务
 *
 * 说明：支持通过环境变量或配置文件指定监听地址与端口。
 * - 默认监听 `0.0.0.0:8080`，满足“对外可访问”的需求。
 * - 日志写入工作目录下 `server/logs`，避免打包后无法写入快照。
 */
const server = http.createServer(handle);
const HOST = process.env.HOST || CONFIG.serverHost || '0.0.0.0';
const PORT = process.env.PORT ? Number(process.env.PORT) : (CONFIG.serverPort || 8080);
server.listen(PORT, HOST, () => console.log(`Server running at http://${HOST}:${PORT}/`));
server.on('error', (err) => {
  // 端口占用时回退到常用备用端口或递增端口，确保服务可启动
  if (err && err.code === 'EADDRINUSE') {
    const fallback = PORT === 8080 ? 8000 : (PORT + 1);
    console.warn(`Port ${PORT} in use, falling back to ${fallback}`);
    server.listen(fallback, HOST, () => console.log(`Server running at http://${HOST}:${fallback}/`));
  } else {
    console.error('Server listen error', err);
  }
});