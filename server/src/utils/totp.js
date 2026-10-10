'use strict';

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function randomSecret(bytes = 20) {
  return toBase32(crypto.randomBytes(bytes));
}

function toBase32(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(secret) {
  const clean = String(secret || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret, counter, digits = 6) {
  const key = fromBase32(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = String(bin % 10 ** digits);
  return otp.padStart(digits, '0');
}

function generate(secret, at = Date.now(), period = 30) {
  return hotp(secret, Math.floor(at / 1000 / period));
}

function verify(secret, code, { window = 1, period = 30, at = Date.now() } = {}) {
  const expected = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(expected) || !secret) return false;
  const counter = Math.floor(at / 1000 / period);
  for (let i = -window; i <= window; i += 1) {
    if (hotp(secret, counter + i) === expected) return true;
  }
  return false;
}

function otpauthUrl({ secret, email, issuer = 'MinhaTela' }) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6`;
}

module.exports = { randomSecret, generate, verify, otpauthUrl };
