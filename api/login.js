const { sendJson, parseBody, method, sameOrigin } = require('../lib/http');
const { setSessionCookie, verifyPassword } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'Origin ditolak.' });

  try {
    const { password } = parseBody(req);
    if (!verifyPassword(password)) {
      return sendJson(res, 401, { ok: false, error: 'Password salah.' });
    }
    setSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || 'Login gagal.' });
  }
};
