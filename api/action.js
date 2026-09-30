const { sendJson, parseBody, method, sameOrigin } = require('../lib/http');
const { isAuthenticated } = require('../lib/auth');
const { gasRequest } = require('../lib/gas');

const ALLOWED_ACTIONS = new Set([
  'saveAccount', 'archiveAccount',
  'saveCategory', 'archiveCategory',
  'saveTransaction', 'deleteTransaction',
  'saveBudget', 'deleteBudget',
  'saveGoal', 'addGoalContribution', 'deleteGoal',
  'saveDebt', 'addDebtPayment', 'deleteDebt',
  'saveRecurring', 'deleteRecurring', 'runRecurringNow',
  'saveSettings'
]);

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'Origin ditolak.' });

  try {
    if (!isAuthenticated(req)) return sendJson(res, 401, { ok: false, error: 'Belum login.' });
    const { action, data } = parseBody(req);
    if (!ALLOWED_ACTIONS.has(action)) {
      return sendJson(res, 400, { ok: false, error: 'Aksi API tidak dikenal.' });
    }
    const result = await gasRequest(action, data === undefined ? null : data);
    return sendJson(res, 200, { ok: true, data: result });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || 'Gagal memproses data.' });
  }
};
