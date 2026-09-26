'use strict';

/**
 * Expo config plugin · Android TV / Fire TV Leanback launcher.
 * Garante LEANBACK_LAUNCHER + banner + feature leanback required=false
 * (app corre em telemóvel e TV com o mesmo APK).
 */
const {
  withAndroidManifest,
  AndroidConfig,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const PACKAGE = 'withMinhaTelaAndroidTv';

function ensureLeanback(androidManifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  const activities = app.activity || [];

  for (const activity of activities) {
    const isMain =
      activity['intent-filter']?.some((f) =>
        (f.action || []).some((a) => a.$?.['android:name'] === 'android.intent.action.MAIN')
      ) || activity.$?.['android:name']?.includes('MainActivity');

    if (!isMain && !String(activity.$?.['android:name'] || '').endsWith('.MainActivity')) {
      continue;
    }

    activity.$ = activity.$ || {};
    activity.$['android:banner'] = activity.$['android:banner'] || '@drawable/tv_banner';
    activity.$['android:logo'] = activity.$['android:logo'] || '@drawable/tv_banner';

    const filters = activity['intent-filter'] || [];
    const hasLeanback = filters.some((f) =>
      (f.category || []).some(
        (c) => c.$?.['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER'
      )
    );

    if (!hasLeanback) {
      filters.push({
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [
          { $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } },
        ],
      });
      activity['intent-filter'] = filters;
    }
  }

  const manifest = androidManifest.manifest;
  manifest['uses-feature'] = manifest['uses-feature'] || [];
  const hasLeanbackFeature = manifest['uses-feature'].some(
    (f) => f.$?.['android:name'] === 'android.software.leanback'
  );
  if (!hasLeanbackFeature) {
    manifest['uses-feature'].push({
      $: {
        'android:name': 'android.software.leanback',
        'android:required': 'false',
      },
    });
  }
  const hasTouch = manifest['uses-feature'].some(
    (f) => f.$?.['android:name'] === 'android.hardware.touchscreen'
  );
  if (!hasTouch) {
    manifest['uses-feature'].push({
      $: {
        'android:name': 'android.hardware.touchscreen',
        'android:required': 'false',
      },
    });
  }

  return androidManifest;
}

const withMinhaTelaAndroidTv = (config) => {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = ensureLeanback(cfg.modResults);
    return cfg;
  });
};

module.exports = createRunOncePlugin(withMinhaTelaAndroidTv, PACKAGE, '1.0.0');
