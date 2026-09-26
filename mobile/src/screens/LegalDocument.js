import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import { getLegalDocument } from '../services/legal';

function renderInline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={{ fontWeight: '700', color: colors.text }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

function MarkdownBody({ md }) {
  const lines = String(md || '').split('\n');
  return (
    <View style={{ gap: 10 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <View key={idx} style={{ height: 6 }} />;
        if (trimmed.startsWith('## ')) {
          return (
            <Text
              key={idx}
              style={{
                color: colors.gold,
                fontSize: 16,
                fontWeight: '700',
                marginTop: 18,
              }}
            >
              {trimmed.slice(3)}
            </Text>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <Text
              key={idx}
              style={{
                color: colors.text,
                fontSize: 28,
                fontWeight: '800',
                borderLeftWidth: 4,
                borderLeftColor: colors.gold,
                paddingLeft: 12,
              }}
            >
              {trimmed.slice(2)}
            </Text>
          );
        }
        if (trimmed.startsWith('- ')) {
          return (
            <Text key={idx} style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}>
              · {renderInline(trimmed.slice(2))}
            </Text>
          );
        }
        return (
          <Text key={idx} style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}>
            {renderInline(trimmed)}
          </Text>
        );
      })}
    </View>
  );
}

export default function LegalDocument({ docType = 'terms', onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getLegalDocument(docType);
        if (alive) setDoc(data);
      } catch (err) {
        if (alive) setError(err.message || 'Falha ao carregar documento');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [docType]);

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
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1.5 }}>
          {brand.name.toUpperCase()}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {docType === 'privacy' ? 'Privacidade' : 'Termos'}
          {doc?.version ? ` · v${doc.version}` : ''}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.red} size="large" />
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
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>
            {doc?.locale} · efectivo {doc?.effectiveAt ? new Date(doc.effectiveAt).toLocaleDateString('pt-AO') : '—'}
          </Text>
          <MarkdownBody md={doc?.bodyMd} />
        </ScrollView>
      )}
    </View>
  );
}
