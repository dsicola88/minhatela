import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { colors, layout, typography } from '../theme/tokens';
import { useI18n } from '../i18n';
import { useDeviceProfile } from '../platform/device';
import Focusable from '../tv/Focusable';

export default function Billboard({ item, onPlay, onMoreInfo, autoplayPreview = true }) {
  const { height, width } = useWindowDimensions();
  const billboardHeight = Math.max(420, height * layout.billboardHeightRatio);
  const isCompact = width < 768;
  const { t } = useI18n();
  const { isTV } = useDeviceProfile();
  const [showTrailer, setShowTrailer] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    setShowTrailer(false);
    if (!item?.trailerUrl || !autoplayPreview || Platform.OS === 'ios') return undefined;
    const timer = setTimeout(() => setShowTrailer(true), 1800);
    return () => clearTimeout(timer);
  }, [item?.id, item?.trailerUrl, autoplayPreview]);

  if (!item) {
    return (
      <View
        style={{
          height: billboardHeight,
          backgroundColor: colors.elevated,
          justifyContent: 'flex-end',
          padding: 40,
        }}
      >
        <Text style={{ color: colors.muted }}>{t('loadingFeatured')}</Text>
      </View>
    );
  }

  const canPreview = Boolean(item.trailerUrl) && showTrailer && Platform.OS === 'web';

  return (
    <View style={{ height: billboardHeight, width: '100%', backgroundColor: colors.black }}>
      {canPreview ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Video
            source={{ uri: item.trailerUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted={muted}
            useNativeControls={false}
          />
        </View>
      ) : (
        <ImageBackground
          source={{ uri: item.backdropUrl || item.posterUrl }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          resizeMode="cover"
        />
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)', colors.black]}
        locations={[0, 0.35, 0.75, 1]}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <View
          style={{
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: isCompact ? 16 : 40,
            paddingBottom: isCompact ? 36 : 56,
            paddingTop: 120,
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderLeftWidth: 3,
              borderLeftColor: colors.gold,
              backgroundColor: 'rgba(206,17,38,0.18)',
            }}
          >
            <Text
              style={{
                color: colors.gold,
                fontSize: isTV ? 14 : 11,
                fontWeight: '700',
                letterSpacing: 1.6,
                textTransform: 'uppercase',
              }}
            >
              {t('originalBadge')}
            </Text>
          </View>

          <Text
            numberOfLines={2}
            style={{
              color: colors.text,
              fontSize: isTV ? 56 : isCompact ? 34 : typography.heroTitle.fontSize,
              fontWeight: typography.heroTitle.fontWeight,
              letterSpacing: typography.heroTitle.letterSpacing,
              maxWidth: isCompact ? '100%' : 640,
              textShadowColor: 'rgba(0,0,0,0.8)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 8,
            }}
          >
            {item.title}
          </Text>

          <Text
            numberOfLines={3}
            style={{
              color: colors.textSecondary,
              fontSize: isTV ? 20 : isCompact ? 14 : 16,
              lineHeight: isTV ? 30 : 24,
              marginTop: 14,
              maxWidth: isCompact ? '100%' : 520,
            }}
          >
            {item.synopsisShort}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 24,
              alignItems: 'center',
            }}
          >
            <Focusable
              id="billboard-play"
              autoFocus
              onPress={() => onPlay?.(item)}
              accessibilityLabel={t('watch')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colors.text,
                paddingHorizontal: isTV ? 28 : 22,
                paddingVertical: isTV ? 16 : 12,
                borderRadius: 4,
              }}
            >
              <Ionicons name="play" size={isTV ? 26 : 20} color={colors.black} />
              <Text style={{ color: colors.black, fontWeight: '700', fontSize: isTV ? 18 : 15 }}>
                {t('watch')}
              </Text>
            </Focusable>

            <Focusable
              id="billboard-info"
              onPress={() => onMoreInfo?.(item)}
              accessibilityLabel={t('moreInfo')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(109,109,110,0.7)',
                paddingHorizontal: isTV ? 28 : 22,
                paddingVertical: isTV ? 16 : 12,
                borderRadius: 4,
              }}
            >
              <Ionicons
                name="information-circle-outline"
                size={isTV ? 26 : 20}
                color={colors.text}
              />
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: isTV ? 18 : 15 }}>
                {t('moreInfo')}
              </Text>
            </Focusable>

            {canPreview ? (
              <Focusable
                id="billboard-mute"
                onPress={() => setMuted((m) => !m)}
                accessibilityLabel={muted ? 'Activar som' : 'Silenciar'}
                style={{
                  width: isTV ? 52 : 42,
                  height: isTV ? 52 : 42,
                  borderRadius: 21,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.55)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.45)',
                }}
              >
                <Ionicons
                  name={muted ? 'volume-mute' : 'volume-high'}
                  size={isTV ? 22 : 18}
                  color={colors.text}
                />
              </Focusable>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
