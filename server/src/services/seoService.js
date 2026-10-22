'use strict';

const contentRepository = require('../repositories/contentRepository');
const { env } = require('../config/env');

function siteBase() {
  return String(env.appPublicUrl || `https://${env.market.primaryDomain}`).replace(/\/$/, '');
}

function robotsTxt() {
  const base = siteBase();
  return [
    'User-agent: *',
    'Allow: /',
    'Allow: /share/',
    'Allow: /title/',
    'Allow: /welcome',
    'Allow: /plans',
    'Allow: /help',
    'Allow: /legal/',
    'Disallow: /admin',
    'Disallow: /account',
    'Disallow: /checkout',
    'Disallow: /watch/',
    'Disallow: /ads',
    'Disallow: /creator-studio',
    'Disallow: /company',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
}

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc, { lastmod, changefreq, priority } = {}) {
  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${xmlEscape(lastmod)}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

async function sitemapXml() {
  const base = siteBase();
  const today = new Date().toISOString().slice(0, 10);
  const staticPaths = [
    ['/', '1.0', 'daily'],
    ['/welcome', '0.9', 'weekly'],
    ['/plans', '0.8', 'weekly'],
    ['/help', '0.6', 'monthly'],
    ['/legal/terms', '0.4', 'yearly'],
    ['/legal/privacy', '0.4', 'yearly'],
  ];

  let rows = [];
  try {
    rows = await contentRepository.listPublishedForSitemap(2000);
  } catch {
    rows = [];
  }
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticPaths.map(([path, priority, changefreq]) =>
      urlEntry(`${base}${path}`, { lastmod: today, changefreq, priority })
    ),
    ...rows.map((row) =>
      urlEntry(`${base}/title/${row.id}`, {
        lastmod: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : today,
        changefreq: 'weekly',
        priority: '0.7',
      })
    ),
    '</urlset>',
    '',
  ].join('\n');
  return body;
}

module.exports = { robotsTxt, sitemapXml, siteBase };
