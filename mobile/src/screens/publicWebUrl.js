function isPrivateHost(hostname) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (/^(127\.|10\.|0\.0\.0\.0|192\.168\.|169\.254\.)/.test(host)) return true;
  const parts = host.split('.').map(Number);
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n))) {
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }
  return false;
}

/** Aceita dhundotec.com, http:// e https:// e grava sempre a ligação segura. */
export function normalizePublicWebUrl(value, { optional = true } = {}) {
  let raw = String(value || '').trim().replace(/\s+/g, '');
  if (!raw) {
    return optional
      ? { ok: true, url: '' }
      : { ok: false, url: '', message: 'Indique o site, por exemplo dhundotec.com' };
  }
  if (/^https:\/\//i.test(raw)) raw = `https://${raw.slice(8)}`;
  else if (/^http:\/\//i.test(raw)) raw = `https://${raw.slice(7)}`;
  else if (raw.startsWith('//')) raw = `https:${raw}`;
  else if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return { ok: false, url: '', message: 'Indique o site, por exemplo dhundotec.com' };
  } else raw = `https://${raw}`;

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

export function destinationFieldText(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}
