async function gasRequest(action, data = null) {
  const url = process.env.GAS_API_URL;
  const apiSecret = process.env.GAS_API_SECRET;

  if (!url) throw new Error('GAS_API_URL belum diatur di Environment Variables.');
  if (!apiSecret) throw new Error('GAS_API_SECRET belum diatur di Environment Variables.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      signal: controller.signal,
      body: JSON.stringify({
        secret: apiSecret,
        action,
        data
      })
    });

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (_) {
      const hint = text.replace(/\s+/g, ' ').slice(0, 140);
      throw new Error(`Respons Apps Script bukan JSON. Cek deployment Web App dan akses "Anyone". ${hint ? `(${hint})` : ''}`);
    }

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Apps Script mengembalikan HTTP ${response.status}.`);
    }

    return payload.data;
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error('Apps Script terlalu lama merespons. Coba lagi beberapa detik.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { gasRequest };
