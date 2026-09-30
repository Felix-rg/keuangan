const { sendJson, method } = require('../lib/http');
const { isAuthenticated } = require('../lib/auth');
const { gasRequest } = require('../lib/gas');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    if (!isAuthenticated(req)) return sendJson(res, 401, { ok: false, error: 'Belum login.' });
    const data = await gasRequest('getDatabaseInfo');
    return sendJson(res, 200, { ok: true, data });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || 'Gagal membaca info database.' });
  }
};
