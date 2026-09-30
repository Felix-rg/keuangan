/**
 * API bridge untuk frontend GitHub/Vercel.
 *
 * File ini DITAMBAHKAN ke project Apps Script Keuangan Mandiri yang lama.
 * Jangan hapus App.gs, Data.gs, Finance.gs karena fungsi bisnis tetap ada di sana.
 * Spreadsheet lama tidak dibuat ulang dan tidak diubah oleh file ini.
 */

const KM_GITHUB_API_SECRET_PROPERTY = 'KM_GITHUB_API_SECRET';

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    assertGithubApiSecret_(body.secret);

    const action = String(body.action || '');
    const data = body.data;
    const result = dispatchGithubApiAction_(action, data);

    return githubApiJson_({ ok: true, data: result });
  } catch (err) {
    return githubApiJson_({
      ok: false,
      error: err && err.message ? err.message : 'Terjadi kesalahan pada API.'
    });
  }
}

function dispatchGithubApiAction_(action, data) {
  switch (action) {
    case 'getBootstrapData':
      return getBootstrapData();
    case 'getDatabaseInfo':
      return getDatabaseInfo();

    case 'saveAccount':
      return saveAccount(data || {});
    case 'archiveAccount':
      return archiveAccount(String(data || ''));

    case 'saveCategory':
      return saveCategory(data || {});
    case 'archiveCategory':
      return archiveCategory(String(data || ''));

    case 'saveTransaction':
      return saveTransaction(data || {});
    case 'deleteTransaction':
      return deleteTransaction(String(data || ''));

    case 'saveBudget':
      return saveBudget(data || {});
    case 'deleteBudget':
      return deleteBudget(String(data || ''));

    case 'saveGoal':
      return saveGoal(data || {});
    case 'addGoalContribution':
      return addGoalContribution(data || {});
    case 'deleteGoal':
      return deleteGoal(String(data || ''));

    case 'saveDebt':
      return saveDebt(data || {});
    case 'addDebtPayment':
      return addDebtPayment(data || {});
    case 'deleteDebt':
      return deleteDebt(String(data || ''));

    case 'saveRecurring':
      return saveRecurring(data || {});
    case 'deleteRecurring':
      return deleteRecurring(String(data || ''));
    case 'runRecurringNow':
      return runRecurringNow();

    case 'saveSettings':
      return saveSettings(data || {});

    default:
      throw new Error('Aksi API tidak dikenal.');
  }
}

function assertGithubApiSecret_(provided) {
  const expected = PropertiesService
    .getScriptProperties()
    .getProperty(KM_GITHUB_API_SECRET_PROPERTY);

  if (!expected) {
    throw new Error('API secret belum dibuat. Jalankan generateGithubApiSecret() sekali.');
  }

  if (!provided || String(provided) !== expected) {
    throw new Error('Unauthorized.');
  }
}

function githubApiJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Jalankan SEKALI dari editor Apps Script.
 * Salin nilai secret yang dikembalikan ke GAS_API_SECRET di Vercel.
 * Menjalankan lagi fungsi ini akan mengganti secret lama.
 */
function generateGithubApiSecret() {
  const secret = (
    Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '')
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(KM_GITHUB_API_SECRET_PROPERTY, secret);

  console.log('GAS_API_SECRET=' + secret);
  return secret;
}

function revokeGithubApiSecret() {
  PropertiesService
    .getScriptProperties()
    .deleteProperty(KM_GITHUB_API_SECRET_PROPERTY);

  return 'API secret dicabut.';
}

function githubApiStatus() {
  const exists = !!PropertiesService
    .getScriptProperties()
    .getProperty(KM_GITHUB_API_SECRET_PROPERTY);

  return {
    apiSecretReady: exists,
    database: getDatabaseInfo()
  };
}
