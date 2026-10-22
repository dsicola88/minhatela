'use strict';

const assert = require('assert');
const { renderShareOgHtml } = require('../src/utils/ogShare');
const { robotsTxt } = require('../src/services/seoService');

const html = renderShareOgHtml({
  title: 'Baía Vermelha',
  synopsis: 'Um thriller em Luanda.',
  posterUrl: 'https://cdn.example/poster.jpg',
  backdropUrl: 'https://cdn.example/backdrop.jpg',
  shareUrl: 'https://minhatela.vercel.app/share/abc',
  openUrl: 'https://minhatela.vercel.app/title/abc',
  kind: 'movie',
  releaseYear: 2026,
});

assert(html.includes('lang="pt-AO"'), 'locale');
assert(html.includes('rel="canonical"'), 'canonical');
assert(html.includes('og:locale" content="pt_AO"'), 'og locale');
assert(html.includes('application/ld+json'), 'jsonld');
assert(html.includes('"@type":"Movie"'), 'movie schema');
assert(html.includes('https://minhatela.vercel.app/share/abc'), 'share url in og');
assert(html.includes('https://minhatela.vercel.app/title/abc'), 'open url');
assert(html.includes('<script type="application/ld+json">'), 'jsonld script');

const robots = robotsTxt();
assert(robots.includes('Sitemap:'), 'sitemap line');
assert(robots.includes('Disallow: /admin'), 'admin blocked');
assert(robots.includes('Allow: /share/'), 'share allowed');

console.log('seo: ok');
