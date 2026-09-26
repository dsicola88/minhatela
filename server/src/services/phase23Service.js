'use strict';

const phase23Repository = require('../repositories/phase23Repository');
const profileRepository = require('../repositories/profileRepository');
const contentRepository = require('../repositories/contentRepository');
const discoveryRepository = require('../repositories/discoveryRepository');
const featureFlagService = require('./featureFlagService');
const auditRepository = require('../repositories/auditRepository');
const { env } = require('../config/env');
const { createError } = require('../utils/errors');

function recommendQuality({ latencyMs, downlinkKbps, dataSaver }) {
  if (dataSaver) return '480p';
  const kbps = Number(downlinkKbps) || 0;
  const latency = Number(latencyMs) || 9999;
  if (kbps > 0) {
    if (kbps < 800) return '480p';
    if (kbps < 2500) return '720p';
    return '1080p';
  }
  if (latency > 400) return '480p';
  if (latency > 180) return '720p';
  return 'auto';
}

function carrierHintFromMeta(meta = {}) {
  const raw = String(meta.connectionType || meta.effectiveType || meta.carrier || '').toLowerCase();
  if (raw.includes('unitel')) return 'Unitel';
  if (raw.includes('movicel')) return 'Movicel';
  if (raw.includes('4g') || raw === '4g') return '4G';
  if (raw.includes('3g') || raw === '3g') return '3G';
  if (raw.includes('wifi') || raw.includes('wifi')) return 'Wi‑Fi';
  return meta.effectiveType || null;
}

async function runDiagnostics(userId, body = {}, meta = {}) {
  await featureFlagService.assertEnabled(
    'network_diagnostics_enabled',
    'Diagnóstico temporariamente indisponível'
  );

  const started = Date.now();
  // Round-trip server processing baseline (cliente envia latency se medido)
  const serverTick = Date.now() - started;
  const latencyMs = Number(body.latencyMs) || serverTick;
  const downlinkKbps = body.downlinkKbps != null ? Number(body.downlinkKbps) : null;
  const dataSaver = body.dataSaver !== false && body.dataSaver !== 'false';
  const quality = recommendQuality({ latencyMs, downlinkKbps, dataSaver });
  const carrierHint = carrierHintFromMeta(body) || carrierHintFromMeta(meta);

  const row = await phase23Repository.saveDiagnostic({
    userId,
    profileId: body.profileId || meta.profileId,
    latencyMs,
    downlinkKbps,
    recommendedQuality: quality,
    carrierHint,
    platform: body.platform || meta.platform,
    clientMeta: {
      effectiveType: body.effectiveType,
      connectionType: body.connectionType,
      rtt: body.rtt,
      saveData: body.saveData,
      userAgent: meta.userAgent,
    },
  });

  const tips = [];
  if (quality === '480p') {
    tips.push('Rede limitada · recomendamos 480p (poupança de dados Angola).');
  }
  if (carrierHint === '3G' || (downlinkKbps && downlinkKbps < 600)) {
    tips.push('Prefira Wi‑Fi para HD. Downloads só em Wi‑Fi estão disponíveis na Conta.');
  }
  if (!tips.length) {
    tips.push('Ligação estável para a qualidade seleccionada.');
  }

  return {
    diagnosticId: row.id,
    latencyMs,
    downlinkKbps,
    recommendedQuality: quality,
    carrierHint,
    tips,
    market: 'AO',
    testedAt: row.created_at,
  };
}

async function whatsappShare(userId, contentId) {
  await featureFlagService.assertEnabled(
    'whatsapp_share_enabled',
    'Partilha WhatsApp indisponível'
  );
  const row = await contentRepository.findPublishedById(contentId);
  if (!row) throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');

  const base = env.appPublicUrl || 'https://minhatela.ao';
  const shareUrl = `${base}/share/${row.id}`;
  const title = row.title;
  const text = `Vê «${title}» na MinhaTela 🇦🇴\n${shareUrl}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return {
    contentId: row.id,
    title,
    shareUrl,
    message: text,
    whatsappUrl: waUrl,
    channels: {
      whatsapp: waUrl,
      copy: text,
      web: shareUrl,
    },
  };
}

async function assertProfile(userId, profileId) {
  if (!profileId) throw createError(400, 'Perfil obrigatório', 'PROFILE_REQUIRED');
  const owned = await profileRepository.findOwned(profileId, userId);
  if (!owned) throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');
  return owned;
}

async function follow(userId, profileId, seriesId, body = {}, meta = {}) {
  await featureFlagService.assertEnabled(
    'series_follow_enabled',
    'Seguir série temporariamente indisponível'
  );
  await assertProfile(userId, profileId);
  const series = await contentRepository.findPublishedById(seriesId);
  if (!series || series.kind !== 'series') {
    throw createError(400, 'Apenas séries podem ser seguidas', 'NOT_A_SERIES');
  }
  const row = await phase23Repository.followSeries({
    profileId,
    seriesId,
    userId,
    notify: body.notify !== false,
  });
  await auditRepository.write({
    actorId: userId,
    action: 'series.followed',
    entity: 'video',
    entityId: seriesId,
    metadata: { profileId },
    ip: meta.ip,
  });
  return {
    following: true,
    seriesId,
    notifyNewEpisodes: row.notify_new_episodes,
    message: `A seguir «${series.title}». Avisamos quando houver novos episódios.`,
  };
}

async function unfollow(userId, profileId, seriesId) {
  await assertProfile(userId, profileId);
  await phase23Repository.unfollowSeries(profileId, seriesId);
  return { following: false, seriesId };
}

async function followState(userId, profileId, seriesId) {
  await assertProfile(userId, profileId);
  const following = await phase23Repository.isFollowing(profileId, seriesId);
  return { following, seriesId };
}

async function myFollows(userId, profileId) {
  await assertProfile(userId, profileId);
  const rows = await phase23Repository.listFollows(profileId);
  return {
    items: rows.map((r) => ({
      seriesId: r.series_id,
      title: r.title,
      posterUrl: r.poster_url,
      slug: r.slug,
      notifyNewEpisodes: r.notify_new_episodes,
      followedAt: r.created_at,
    })),
  };
}

async function languagesHub(maturityMax = 18) {
  await featureFlagService.assertEnabled(
    'languages_hub_enabled',
    'Hub de idiomas indisponível'
  );
  const languages = await phase23Repository.listLanguages();
  const categories = await phase23Repository.listCategoryHub();
  return {
    languages: languages.map((l) => ({
      code: l.language,
      label:
        l.language === 'pt'
          ? 'Português'
          : l.language === 'en'
            ? 'English'
            : l.language === 'umb'
              ? 'Umbundu'
              : l.language === 'kmb'
                ? 'Kimbundu'
                : l.language,
      count: l.count,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      count: c.count,
    })),
    market: 'AO',
    maturityMax,
  };
}

async function byLanguage(lang, maturityMax = 18) {
  const rows = await phase23Repository.byLanguage(lang, maturityMax, 40);
  return {
    language: lang,
    items: rows.map((r) => ({
      ...discoveryRepository.mapCard(r),
      isOriginal: Boolean(r.is_original),
    })),
  };
}

async function byCategory(slug, maturityMax = 18) {
  const rows = await phase23Repository.byCategorySlug(slug, maturityMax, 40);
  return {
    category: slug,
    items: rows.map((r) => ({
      ...discoveryRepository.mapCard(r),
      isOriginal: Boolean(r.is_original),
    })),
  };
}

function mapInvoice(row) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    title: row.title,
    amountKz: row.amount_kz,
    currency: row.currency,
    status: row.status,
    issuedAt: row.issued_at,
    transactionId: row.transaction_id,
    metadata: row.metadata || {},
  };
}

async function listInvoices(userId) {
  await featureFlagService.assertEnabled(
    'billing_invoices_enabled',
    'Facturas temporariamente indisponíveis'
  );
  const rows = await phase23Repository.listInvoices(userId);
  return { invoices: rows.map(mapInvoice) };
}

async function getInvoice(userId, invoiceId, { html = false } = {}) {
  await featureFlagService.assertEnabled(
    'billing_invoices_enabled',
    'Facturas temporariamente indisponíveis'
  );
  const row = await phase23Repository.findInvoice(userId, invoiceId);
  if (!row) throw createError(404, 'Factura não encontrada', 'INVOICE_NOT_FOUND');
  const invoice = mapInvoice(row);
  if (!html) return { invoice };

  const htmlDoc = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/><title>${invoice.invoiceNumber}</title>
<style>body{font-family:system-ui;background:#111;color:#fff;padding:40px}h1{color:#F7D417}.meta{color:#aaa} .amt{font-size:28px;font-weight:800;color:#CE1126}</style></head>
<body><h1>MinhaTela · Factura</h1>
<p class="meta">${invoice.invoiceNumber} · ${new Date(invoice.issuedAt).toLocaleString('pt-AO')}</p>
<p>${invoice.title}</p>
<p class="amt">${Number(invoice.amountKz).toLocaleString('pt-AO')} Kz</p>
<p class="meta">Estado: ${invoice.status} · AOA</p>
</body></html>`;
  return { invoice, html: htmlDoc };
}

module.exports = {
  runDiagnostics,
  whatsappShare,
  follow,
  unfollow,
  followState,
  myFollows,
  languagesHub,
  byLanguage,
  byCategory,
  listInvoices,
  getInvoice,
  recommendQuality,
};
