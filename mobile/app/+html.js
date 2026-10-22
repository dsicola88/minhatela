import { ScrollViewStyleReset } from 'expo-router/html';

const SITE_TITLE = 'MinhaTela — Cinema e séries de Angola';
const SITE_DESCRIPTION =
  'Assista filmes e séries de Angola na MinhaTela. Catálogo com IBAN e Multicaixa Express. Telemóvel, computador e televisão.';
const SITE_URL = 'https://minhatela.net';
const SITE_IMAGE = 'https://minhatela.vercel.app/favicon.png';

/**
 * Documento HTML base do site web.
 * Com export single o Metro ainda usa este invólucro no shell inicial.
 */
export default function Root({ children }) {
  return (
    <html lang="pt-AO">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>{SITE_TITLE}</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <meta name="theme-color" content="#000000" />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={SITE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="pt_AO" />
        <meta property="og:site_name" content="MinhaTela" />
        <meta property="og:title" content={SITE_TITLE} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={SITE_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SITE_TITLE} />
        <meta name="twitter:description" content={SITE_DESCRIPTION} />
        <meta name="twitter:image" content={SITE_IMAGE} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'html,body,#root{height:100%;background:#000;}' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
