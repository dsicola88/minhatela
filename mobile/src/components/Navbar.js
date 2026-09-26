import { useEffect, useState } from 'react';
import {
  View,
  Text,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, brand, layout } from '../theme/tokens';
import { useI18n } from '../i18n';
import Focusable from '../tv/Focusable';
import { useDeviceProfile } from '../platform/device';

export default function Navbar({
  scrollY = 0,
  onSearch,
  onProfile,
  onAdmin,
  onCreatorStudio,
  onAds,
  onNotifications,
  onMyList,
  onNewHot,
  onBrowse,
  onPremieres,
  onForYou,
  onLanguages,
  unreadCount = 0,
  showLinks = true,
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [solid, setSolid] = useState(false);
  const isCompact = width < 768;
  const { t, locale, setLocale } = useI18n();
  const { isTV } = useDeviceProfile();

  useEffect(() => {
    setSolid(scrollY > 40);
  }, [scrollY]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingTop: insets.top,
      }}
    >
      <LinearGradient
        colors={
          solid
            ? [colors.black, colors.black]
            : ['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.35)', 'transparent']
        }
        style={{
          minHeight: layout.navbarHeight + insets.top,
          paddingHorizontal: isCompact ? 16 : 40,
          paddingBottom: 12,
          justifyContent: 'flex-end',
          backgroundColor: solid ? colors.black : 'transparent',
          borderBottomWidth: solid ? 1 : 0,
          borderBottomColor: colors.red,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 28 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: colors.gold,
                }}
              />
              <Text
                style={{
                  color: colors.red,
                  fontSize: isCompact ? 22 : 26,
                  fontWeight: '800',
                  letterSpacing: 1.4,
                }}
              >
                {brand.name.toUpperCase()}
              </Text>
            </View>

            {showLinks && !isCompact && !isTV ? (
              <View style={{ flexDirection: 'row', gap: 22, alignItems: 'center' }}>
                {[
                  { label: t('navHome'), onPress: null },
                  { label: t('navNewHot'), onPress: onNewHot },
                  { label: 'Estreias', onPress: onPremieres },
                  { label: 'Para si', onPress: onForYou },
                  { label: 'Categorias', onPress: onLanguages },
                  { label: t('navSeries'), onPress: onBrowse ? () => onBrowse('series') : null },
                  { label: t('navFilms'), onPress: onBrowse ? () => onBrowse('films') : null },
                  { label: t('navAngola'), onPress: onBrowse ? () => onBrowse('angola') : null },
                  { label: t('navMyList'), onPress: onMyList },
                ].map((item, index) =>
                  item.onPress ? (
                    <Focusable key={item.label} id={`nav-link-${index}`} onPress={item.onPress}>
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 14,
                          fontWeight: '500',
                        }}
                      >
                        {item.label}
                      </Text>
                    </Focusable>
                  ) : (
                    <Text
                      key={item.label}
                      style={{
                        color: index === 0 ? colors.text : colors.textSecondary,
                        fontSize: 14,
                        fontWeight: index === 0 ? '700' : '500',
                      }}
                    >
                      {item.label}
                    </Text>
                  )
                )}
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: isTV ? 22 : 16 }}>
            <Focusable
              id="nav-lang"
              onPress={() => setLocale(locale === 'pt' ? 'en' : 'pt')}
              accessibilityLabel={t('language')}
              style={{ paddingHorizontal: 8, paddingVertical: 6 }}
            >
              <Text style={{ color: colors.gold, fontWeight: '700', fontSize: isTV ? 16 : 12 }}>
                {locale.toUpperCase()}
              </Text>
            </Focusable>
            {onCreatorStudio ? (
              <Focusable id="nav-creator" onPress={onCreatorStudio} accessibilityLabel="Creator Studio">
                <Ionicons name="film-outline" size={isTV ? 28 : 22} color={colors.text} />
              </Focusable>
            ) : null}
            {onAds ? (
              <Focusable id="nav-ads" onPress={onAds} accessibilityLabel="Ad Platform">
                <Ionicons name="megaphone-outline" size={isTV ? 28 : 22} color={colors.text} />
              </Focusable>
            ) : null}
            {onAdmin ? (
              <Focusable id="nav-admin" onPress={onAdmin} accessibilityLabel="Administração">
                <Ionicons name="shield-checkmark-outline" size={isTV ? 28 : 22} color={colors.gold} />
              </Focusable>
            ) : null}
            <Focusable id="nav-search" onPress={onSearch} accessibilityLabel="Pesquisar" autoFocus={false}>
              <Ionicons name="search" size={isTV ? 28 : 22} color={colors.text} />
            </Focusable>
            {onNotifications ? (
              <Focusable
                id="nav-notifications"
                onPress={onNotifications}
                accessibilityLabel="Notificações"
                style={{ position: 'relative' }}
              >
                <Ionicons name="notifications-outline" size={isTV ? 28 : 22} color={colors.text} />
                {unreadCount > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -6,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: colors.red,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 3,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 9, fontWeight: '800' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </Focusable>
            ) : null}
            <Focusable
              id="nav-profile"
              onPress={onProfile}
              accessibilityLabel="Perfil"
              style={{
                width: isTV ? 40 : 32,
                height: isTV ? 40 : 32,
                borderRadius: 4,
                backgroundColor: colors.red,
                borderWidth: 1,
                borderColor: colors.redDark,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person" size={isTV ? 20 : 16} color={colors.text} />
            </Focusable>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
