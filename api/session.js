const { sendJson, method } = require('../lib/http');
const { isAuthenticated } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  let authenticated = false;
  try { authenticated = isAuthenticated(req); } catch (_) {}
  sendJson(res, 200, { authenticated });
};
