const { sendJson, method } = require('../lib/http');
const { clearSessionCookie } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  clearSessionCookie(res);
  sendJson(res, 200, { ok: true });
};
