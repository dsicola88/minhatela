import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import { fetchPerson } from '../services/watchTogether';
import Focusable from '../tv/Focusable';

export default function Person({ slug, onBack, onSelectTitle }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchPerson(slug);
        if (alive) setPerson(data);
      } catch (err) {
        if (alive) setError(err.message || 'Pessoa não encontrada');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const cardW = isCompact ? (width - 48) / 2 : 160;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: isCompact ? 16 : 40,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 12,
        }}
      >
        <Focusable id="person-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', flex: 1 }}>
          {person?.fullName || 'Elenco'}
        </Text>
        <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1 }}>
          {brand.name.toUpperCase()}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.red} />
        </View>
      ) : error ? (
        <Text style={{ color: colors.red, padding: 24 }}>{error}</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: isCompact ? 16 : 40,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            paddingBottom: 80,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 8,
                backgroundColor: colors.elevated,
                borderWidth: 1,
                borderColor: colors.gold,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {person.photoUrl ? (
                <Image source={{ uri: person.photoUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={{ color: colors.gold, fontSize: 36, fontWeight: '800' }}>
                  {(person.fullName || '?').slice(0, 1)}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>
                {person.fullName}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>
                {(person.roleDefault || 'actor').toUpperCase()}
                {person.nationality ? ` · ${person.nationality}` : ''}
              </Text>
            </View>
          </View>

          {person.bio ? (
            <Text style={{ color: colors.textSecondary, lineHeight: 22, marginBottom: 24 }}>
              {person.bio}
            </Text>
          ) : null}

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 1.2,
              marginBottom: 12,
            }}
          >
            TÍTULOS
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {(person.titles || []).map((item) => (
              <Pressable
                key={`${item.id}-${item.role}`}
                onPress={() => onSelectTitle?.(item)}
                style={{ width: cardW }}
              >
                <Image
                  source={{ uri: item.posterUrl }}
                  style={{
                    width: '100%',
                    aspectRatio: 2 / 3,
                    borderRadius: 4,
                    backgroundColor: '#111',
                  }}
                />
                <Text
                  numberOfLines={2}
                  style={{ color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 6 }}
                >
                  {item.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {item.role}
                  {item.characterName ? ` · ${item.characterName}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
