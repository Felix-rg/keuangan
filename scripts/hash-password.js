const crypto = require('crypto');

const password = process.argv.slice(2).join(' ');
if (!password) {
  console.error('Pakai: node scripts/hash-password.js "password-kamu"');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
console.log(`scrypt$${salt}$${hash}`);
