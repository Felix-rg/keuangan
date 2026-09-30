const crypto = require('crypto');

const COOKIE_NAME = 'km_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.SESSION_SECRET || '';
  if (value.length < 32) {
    throw new Error('SESSION_SECRET belum diatur atau terlalu pendek. Minimal 32 karakter.');
  }
  return value;
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

function createSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    iat: now,
    exp: now + SESSION_SECONDS,
    n: crypto.randomBytes(12).toString('hex')
  }));
  return `${payload}.${sign(payload)}`;
}

function timingEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifySessionToken(token) {
  try {
    if (!token || !token.includes('.')) return false;
    const [payload, signature] = token.split('.');
    if (!payload || !signature || !timingEqual(signature, sign(payload))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    return Number(data.exp || 0) > now;
  } catch (_) {
    return false;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return acc;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function isAuthenticated(req) {
  return verifySessionToken(parseCookies(req)[COOKIE_NAME]);
}

function setSessionCookie(res) {
  const token = createSessionToken();
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function verifyPassword(password) {
  const input = String(password || '');
  const encoded = process.env.APP_PASSWORD_HASH || '';

  if (encoded) {
    const parts = encoded.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      throw new Error('Format APP_PASSWORD_HASH salah.');
    }
    const [, salt, expectedHex] = parts;
    const actual = crypto.scryptSync(input, salt, 64).toString('hex');
    return timingEqual(actual, expectedHex);
  }

  const raw = process.env.APP_PASSWORD || '';
  if (!raw) throw new Error('APP_PASSWORD_HASH atau APP_PASSWORD belum diatur.');
  const actual = crypto.createHash('sha256').update(input).digest();
  const expected = crypto.createHash('sha256').update(raw).digest();
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = {
  isAuthenticated,
  setSessionCookie,
  clearSessionCookie,
  verifyPassword
};
