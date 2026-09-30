# Keuangan Mandiri

Aplikasi pencatatan keuangan pribadi dengan tampilan yang sama seperti versi Google Apps Script lama, tetapi frontend dijalankan dari Vercel dan source code aman untuk disimpan di repository GitHub publik.

Data tetap memakai **Google Spreadsheet lama yang sudah berisi transaksi**. Project ini **tidak membuat spreadsheet baru, tidak menjalankan setup ulang, dan tidak memindahkan data**.

## Arsitektur

```text
Browser / HP
    ↓
Vercel (frontend + login + serverless API)
    ↓  server-to-server, API secret tidak terlihat browser
Google Apps Script Web App
    ↓
Google Spreadsheet lama
```

GitHub hanya menyimpan source code. Secret dan password disimpan di Environment Variables Vercel, bukan di repository.

## Fitur

- Login pribadi dengan cookie session HttpOnly.
- Dashboard saldo, pemasukan, pengeluaran, cashflow, hutang, piutang, dan grafik 6 bulan.
- Transaksi pemasukan, pengeluaran, dan transfer antar akun.
- Laporan bulanan + export CSV + print.
- Budget per kategori.
- Target keuangan + setoran target.
- Hutang dan piutang + riwayat pembayaran.
- Transaksi berulang.
- Akun kas, bank, e-wallet, tabungan, dll.
- Kategori dan pengaturan.
- Data cache di `sessionStorage` agar buka ulang terasa lebih cepat.
- Google Sheets tetap menjadi sumber data utama.

---

# 1. Hubungkan Apps Script lama

Buka **project Apps Script Keuangan Mandiri yang sekarang**. Jangan buat database baru.

Buat file baru bernama:

```text
Api.gs
```

Salin isi:

```text
apps-script/Api.gs
```

ke file tersebut.

> Jangan hapus `App.gs`, `Data.gs`, atau `Finance.gs`. `Api.gs` hanya menjadi jembatan API menuju fungsi yang sudah ada.

### Buat API secret

Di editor Apps Script pilih fungsi:

```javascript
generateGithubApiSecret
```

Klik **Run** satu kali.

Fungsi akan menghasilkan string panjang. Simpan hasilnya. Itu nanti menjadi:

```text
GAS_API_SECRET
```

Kalau secret hilang, jalankan lagi fungsi tersebut. Secret lama otomatis tidak berlaku.

### Update deployment Apps Script

Masuk:

```text
Deploy
→ Manage deployments
→ Edit deployment
```

Gunakan konfigurasi Web App:

```text
Execute as : Me
Who has access : Anyone
```

Lalu pilih **New version** dan deploy.

Salin URL Web App yang berakhiran:

```text
/exec
```

Contoh:

```text
https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec
```

URL itu menjadi `GAS_API_URL`.

**Penting:** walaupun deployment Apps Script dapat diakses `Anyone`, API tetap membutuhkan `GAS_API_SECRET`. Secret hanya disimpan di Vercel dan tidak pernah dikirim ke browser.

---

# 2. Upload ke GitHub

Buat repository baru, misalnya:

```text
keuangan-mandiri
```

Boleh **Public**.

Upload seluruh isi folder project ini ke repository. Jangan upload file `.env` berisi secret. `.gitignore` sudah disediakan karena manusia rupanya tetap perlu dipagari dari kemungkinan commit password sendiri.

Contoh lewat Git:

```bash
git init
git add .
git commit -m "Initial Keuangan Mandiri"
git branch -M main
git remote add origin https://github.com/USERNAME/keuangan-mandiri.git
git push -u origin main
```

---

# 3. Deploy ke Vercel

1. Login ke Vercel menggunakan GitHub.
2. Klik **Add New → Project**.
3. Import repository `keuangan-mandiri`.
4. Framework preset dapat dibiarkan **Other** / otomatis.
5. Tambahkan Environment Variables di bawah.
6. Klik **Deploy**.

Project ini tidak membutuhkan build framework atau database Vercel. HTML/CSS/JS disajikan sebagai static files dan folder `/api` menjadi Vercel Functions.

## Environment Variables

Wajib:

```text
GAS_API_URL
GAS_API_SECRET
SESSION_SECRET
```

Untuk password login pilih salah satu:

```text
APP_PASSWORD
```

atau yang lebih rapi:

```text
APP_PASSWORD_HASH
```

### Cara paling gampang

Set:

```text
APP_PASSWORD = password-login-kamu
```

Password ini tetap berada di server Vercel dan tidak masuk source code.

### Cara dengan hash

Di komputer yang memiliki Node.js:

```bash
npm run hash-password -- "password-kamu"
```

Salin hasilnya menjadi:

```text
APP_PASSWORD_HASH
```

Kalau `APP_PASSWORD_HASH` ada, aplikasi akan mengabaikan `APP_PASSWORD`.

### Generate SESSION_SECRET

```bash
npm run generate-secret
```

Salin hasilnya ke:

```text
SESSION_SECRET
```

Minimal 32 karakter.

---

# 4. Environment Variable contoh

Lihat `.env.example`.

Konfigurasi Vercel akhirnya kira-kira:

```text
GAS_API_URL=https://script.google.com/macros/s/...../exec
GAS_API_SECRET=<hasil generateGithubApiSecret>
APP_PASSWORD=<password aplikasi>
SESSION_SECRET=<random panjang>
```

Setelah mengubah Environment Variables, lakukan redeploy Vercel.

---

# 5. Update aplikasi berikutnya

Setelah Vercel terhubung ke GitHub, workflow selanjutnya cuma:

```text
edit code
→ commit
→ push GitHub
→ Vercel deploy otomatis
```

Tidak perlu copy HTML ke Apps Script lagi.

Apps Script hanya perlu disentuh kalau API bridge (`Api.gs`) memang berubah.

---

# 6. Apakah data lama aman?

Ya. `Api.gs` tidak memiliki fungsi membuat atau reset spreadsheet.

Ia hanya memanggil fungsi yang sudah ada pada project lama, seperti:

```text
getBootstrapData
saveTransaction
deleteTransaction
saveBudget
saveGoal
saveDebt
saveRecurring
saveAccount
...
```

Artinya sheet lama seperti:

```text
Akun
Kategori
Transaksi
Budget
Target
Target_Log
Hutang_Piutang
Hutang_Piutang_Log
Berulang
Pengaturan
```

langsung dipakai apa adanya.

**Jangan jalankan `setupApp()` lagi hanya untuk memasang frontend baru.** Tidak dibutuhkan.

---

# 7. Kalau muncul error

### `Respons Apps Script bukan JSON`

Biasanya deployment Apps Script belum diperbarui atau akses Web App bukan `Anyone`.

Periksa:

```text
Deploy → Manage deployments → Edit → New version
Execute as: Me
Who has access: Anyone
```

### `Unauthorized`

`GAS_API_SECRET` di Vercel berbeda dengan secret yang ada di Script Properties Apps Script.

Jalankan ulang:

```javascript
generateGithubApiSecret()
```

lalu update `GAS_API_SECRET` di Vercel.

### Login selalu gagal

Periksa `APP_PASSWORD` atau `APP_PASSWORD_HASH` di Environment Variables lalu redeploy.

### Web tampil tetapi data lama tidak muncul

Pastikan `Api.gs` ditambahkan ke **project Apps Script lama yang memang terhubung ke spreadsheet lama**, bukan project Apps Script baru.

---

# Struktur repository

```text
keuangan-mandiri/
├── api/
│   ├── action.js
│   ├── bootstrap.js
│   ├── database.js
│   ├── login.js
│   ├── logout.js
│   └── session.js
├── apps-script/
│   └── Api.gs
├── assets/
│   └── icon.svg
├── lib/
│   ├── auth.js
│   ├── gas.js
│   └── http.js
├── scripts/
│   ├── generate-secret.js
│   └── hash-password.js
├── .env.example
├── .gitignore
├── app.js
├── index.html
├── manifest.webmanifest
├── package.json
├── styles.css
└── vercel.json
```

## Catatan keamanan

- Jangan simpan API secret atau password di `app.js`, `index.html`, atau repository.
- Gunakan Environment Variables Vercel.
- Session login disimpan sebagai cookie `HttpOnly`, `SameSite=Strict`, dan `Secure` di production.
- Browser tidak berkomunikasi langsung dengan Apps Script. Vercel yang menjadi proxy, jadi `GAS_API_SECRET` tidak terekspos ke DevTools browser.
