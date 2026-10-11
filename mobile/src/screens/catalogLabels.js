export function accessLabel(code) {
  if (code === 'avod') return 'Grátis';
  if (code === 'svod') return 'Premium';
  if (code === 'tvod') return 'Aluguer';
  return '';
}

export function kindLabel(kind) {
  return kind === 'series' ? 'Série' : 'Filme';
}

export function titleMeta(item) {
  return [kindLabel(item.kind), accessLabel(item.monetization), item.genre, item.releaseYear]
    .filter(Boolean)
    .join(' · ');
}
