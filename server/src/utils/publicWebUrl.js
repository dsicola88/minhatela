'use strict';

const net = require('net');

function coercePublicHttps(value) {
  let raw = String(value || '').trim().replace(/\s+/g, '');
  if (!raw || raw.startsWith('/uploads/')) return raw;
  if (/^https:\/\//i.test(raw)) return `https://${raw.slice(8)}`;
  if (/^http:\/\//i.test(raw)) return `https://${raw.slice(7)}`;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  return `https://${raw}`;
}

function isPrivateHost(hostname) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === 'metadata.google.internal' ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  const ip = net.isIP(host) ? host : null;
  if (!ip) return false;
  if (ip === '0.0.0.0' || ip === '::' || ip === '::1') return true;
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10 || parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return false;
}

function normalizePublicWebUrl(value, { optional = false, allowUpload = false } = {}) {
  const raw = coercePublicHttps(value);
  if (!raw) {
    return optional
      ? { ok: true, url: '' }
      : { ok: false, url: '', message: 'Indique o site, por exemplo dhundotec.com' };
  }
  if (raw.startsWith('/uploads/')) {
    if (!allowUpload || raw.includes('..') || raw.includes('\\') || !raw.startsWith('/uploads/ads/')) {
      return { ok: false, url: '', message: 'Indique o site público da empresa' };
    }
    return { ok: true, url: raw };
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, url: '', message: 'Este endereço não está completo' };
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.includes('.')) {
    return { ok: false, url: '', message: 'Indique o site, por exemplo dhundotec.com' };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { ok: false, url: '', message: 'Use o site público da empresa' };
  }
  return { ok: true, url: parsed.toString() };
}

module.exports = { coercePublicHttps, normalizePublicWebUrl, isPrivateHost };
