'use strict';

/**
 * Bunny Stream video GUIDs são UUID v4.
 * Placeholders locais (pending-*, demo-bunny-*) nunca devem ir a play/publish.
 */
const BUNNY_GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidBunnyVideoId(value) {
  if (!value || typeof value !== 'string') return false;
  const id = value.trim();
  if (!id) return false;
  if (/^(pending-|demo-bunny-)/i.test(id)) return false;
  return BUNNY_GUID_RE.test(id);
}

function assertBunnyVideoId(value, { required = true } = {}) {
  if (!value || !String(value).trim()) {
    if (!required) return null;
    const err = new Error('Bunny Video ID obrigatório');
    err.status = 400;
    err.code = 'BUNNY_VIDEO_REQUIRED';
    throw err;
  }
  const id = String(value).trim();
  if (!isValidBunnyVideoId(id)) {
    const err = new Error(
      'Bunny Video ID inválido. Use o GUID UUID da library Stream (não pending-/demo-).'
    );
    err.status = 400;
    err.code = 'BUNNY_VIDEO_INVALID';
    throw err;
  }
  return id;
}

module.exports = {
  isValidBunnyVideoId,
  assertBunnyVideoId,
};
