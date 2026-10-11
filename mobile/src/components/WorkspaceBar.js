import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout } from '../theme/tokens';

/**
 * Barra das consolas (Anúncios / Estúdio). Não é o navbar do catálogo.
 */
export default function WorkspaceBar({
  product = 'Anúncios',
  kicker = 'MINHATELA',
  links = [],
  onCatalog,
}) {
  const { width } = useWindowDimensions();
  const compact = width < 720;

  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.navbar,
        paddingHorizontal: compact ? 16 : 28,
        paddingVertical: 14,
      }}
    >
      <View
        style={{
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          flexDirection: compact ? 'column' : 'row',
          alignItems: compact ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View>
          <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 }}>
            {kicker}
          </Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{product}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          {links.map((link) =>
            link?.onPress ? (
              <Pressable key={link.label} onPress={link.onPress}>
                <Text
                  style={{
                    color: link.active ? colors.gold : colors.textSecondary,
                    fontWeight: '700',
                    fontSize: 14,
                  }}
                >
                  {link.label}
                </Text>
              </Pressable>
            ) : null
          )}
          {onCatalog ? (
            <Pressable
              onPress={onCatalog}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="play-outline" size={16} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 13 }}>Ver catálogo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
