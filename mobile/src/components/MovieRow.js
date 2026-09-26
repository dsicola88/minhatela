import { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { colors, layout } from '../theme/tokens';
import { useDeviceProfile } from '../platform/device';
import Focusable from '../tv/Focusable';

function MonetizationBadge({ model, kind, badge, rank }) {
  if (rank || (badge && String(badge).startsWith('N.º'))) {
    return (
      <View
        style={{
          position: 'absolute',
          bottom: 36,
          left: 6,
          minWidth: 28,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 42,
            fontWeight: '900',
            textShadowColor: 'rgba(0,0,0,0.9)',
            textShadowOffset: { width: 2, height: 2 },
            textShadowRadius: 4,
            lineHeight: 46,
          }}
        >
          {rank || String(badge).replace('N.º ', '')}
        </Text>
      </View>
    );
  }

  if (badge === 'EM BREVE' || badge === 'NOVO') {
    return (
      <View
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          backgroundColor: 'rgba(0,0,0,0.75)',
          borderWidth: 1,
          borderColor: colors.gold,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 2,
        }}
      >
        <Text style={{ color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>
          {badge}
        </Text>
      </View>
    );
  }

  if (kind === 'series') {
    return (
      <View
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          backgroundColor: 'rgba(0,0,0,0.75)',
          borderWidth: 1,
          borderColor: colors.gold,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 2,
        }}
      >
        <Text style={{ color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>
          SÉRIE
        </Text>
      </View>
    );
  }

  const map = {
    avod: { label: 'GRÁTIS', color: colors.gold },
    svod: { label: 'PREMIUM', color: colors.red },
    tvod: { label: 'ALUGAR', color: colors.goldMuted },
  };
  const meta = map[model] || map.avod;

  return (
    <View
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderWidth: 1,
        borderColor: meta.color,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 2,
      }}
    >
      <Text style={{ color: meta.color, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>
        {meta.label}
      </Text>
    </View>
  );
}

function ProgressBar({ percentage }) {
  if (!percentage || percentage <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
      }}
    >
      <View
        style={{
          width: `${Math.min(100, percentage)}%`,
          height: '100%',
          backgroundColor: colors.red,
        }}
      />
    </View>
  );
}

function MovieCard({ item, cardWidth, onPress, resumeMode, focusId, enableHoverPreview }) {
  const percentage = item.progress?.percentage || 0;
  const [hovered, setHovered] = useState(false);
  const showPreview =
    enableHoverPreview &&
    Platform.OS === 'web' &&
    hovered &&
    Boolean(item.trailerUrl) &&
    !resumeMode;

  return (
    <Focusable
      id={focusId}
      onPress={() => onPress?.(item)}
      accessibilityLabel={item.title}
      style={{
        width: cardWidth,
        marginRight: 12,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: '#111111',
        zIndex: hovered ? 20 : 1,
        ...(Platform.OS === 'web'
          ? {
              transition: 'transform 180ms ease, box-shadow 180ms ease',
              transform: hovered ? 'scale(1.08)' : 'scale(1)',
              boxShadow: hovered ? '0 18px 40px rgba(0,0,0,0.65)' : 'none',
            }
          : {}),
      }}
      {...(Platform.OS === 'web'
        ? {
            onHoverIn: () => setHovered(true),
            onHoverOut: () => setHovered(false),
          }
        : {})}
    >
      {({ focused, isTV }) => (
        <View
          style={{
            aspectRatio: layout.cardAspectRatio,
            backgroundColor: '#111111',
            transform: [{ scale: focused && !isTV && Platform.OS !== 'web' ? 1.02 : 1 }],
          }}
        >
          {showPreview ? (
            <Video
              source={{ uri: item.trailerUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
              useNativeControls={false}
            />
          ) : (
            <Image
              source={{ uri: item.posterUrl || item.backdropUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          )}
          {!resumeMode ? (
            <MonetizationBadge
              model={item.monetization}
              kind={item.kind}
              badge={item.badge}
              rank={item.rank}
            />
          ) : null}
          {resumeMode && item.syncedFromOtherDevice ? (
            <View
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderWidth: 1,
                borderColor: colors.gold,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 2,
                zIndex: 5,
              }}
            >
              <Text style={{ color: colors.gold, fontSize: 9, fontWeight: '800' }}>
                SYNC{item.lastDeviceName ? ` · ${String(item.lastDeviceName).slice(0, 10)}` : ''}
              </Text>
            </View>
          ) : null}
          {resumeMode ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.25)',
              }}
            >
              <View
                style={{
                  width: isTV ? 56 : 44,
                  height: isTV ? 56 : 44,
                  borderRadius: 28,
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  borderWidth: 1,
                  borderColor: colors.text,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="play"
                  size={isTV ? 26 : 20}
                  color={colors.text}
                  style={{ marginLeft: 2 }}
                />
              </View>
            </View>
          ) : null}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: 8,
              paddingTop: 8,
              paddingBottom: percentage ? 10 : 8,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: colors.text, fontSize: isTV ? 15 : 12, fontWeight: '600' }}
            >
              {item.title}
            </Text>
          </View>
          <ProgressBar percentage={percentage} />
        </View>
      )}
    </Focusable>
  );
}

function useDeviceWithCompact() {
  const profile = useDeviceProfile();
  return { ...profile, isCompact: profile.width < 768 };
}

const chevronStyle = {
  width: 32,
  height: 32,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.border,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#181818',
};

export default function MovieRow({
  title,
  videos = [],
  onSelect,
  resumeMode = false,
  enableHoverPreview = true,
}) {
  const scrollRef = useRef(null);
  const offsetRef = useRef(0);
  const { width, isTV, isCompact } = useDeviceWithCompact();
  const cardWidth = isTV
    ? Math.min(340, width * 0.28)
    : isCompact
      ? Math.min(220, width * 0.62)
      : 280;

  if (!videos.length) return null;

  const scrollBy = (direction) => {
    const next = Math.max(0, offsetRef.current + direction * cardWidth * 2.2);
    offsetRef.current = next;
    scrollRef.current?.scrollTo({ x: next, animated: true });
  };

  return (
    <View style={{ marginBottom: isTV ? 36 : 28, overflow: 'visible' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: isCompact ? 16 : 40,
          marginBottom: 12,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: isTV ? 26 : isCompact ? 17 : 20,
            fontWeight: '700',
          }}
        >
          {title}
        </Text>

        {Platform.OS === 'web' && width >= 900 ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => scrollBy(-1)} accessibilityLabel="Anterior" style={chevronStyle}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => scrollBy(1)} accessibilityLabel="Seguinte" style={chevronStyle}>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          offsetRef.current = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: isCompact ? 16 : 40,
          paddingVertical: isTV ? 12 : 6,
        }}
        decelerationRate="fast"
        style={{ overflow: 'visible' }}
      >
        {videos.map((item, index) => (
          <MovieCard
            key={item.id}
            focusId={`row-${title}-${item.id}-${index}`}
            item={item}
            cardWidth={cardWidth}
            onPress={onSelect}
            resumeMode={resumeMode}
            enableHoverPreview={enableHoverPreview && !isTV}
          />
        ))}
      </ScrollView>
    </View>
  );
}
