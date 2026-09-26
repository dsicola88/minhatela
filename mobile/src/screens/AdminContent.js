import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../components/ui';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { colors, layout } from '../theme/tokens';
import {
  fetchPendingCreators,
  reviewCreator,
  fetchPendingContent,
  moderateContent,
} from '../services/admin';
import { fetchPendingPayouts, reviewPayout } from '../services/payouts';

export default function AdminContent({ onBack, onPayments }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creators, setCreators] = useState([]);
  const [contents, setContents] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [c, content, p] = await Promise.all([
        fetchPendingCreators(),
        fetchPendingContent('submitted'),
        fetchPendingPayouts(),
      ]);
      setCreators(c.creators || []);
      setContents(content.contents || []);
      setPayouts(p.payouts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          padding: isCompact ? 16 : 32,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 64,
        }}
      >
        <Pressable
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={{ color: colors.textSecondary }}>Voltar</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <PrimaryButton label="Pagamentos" variant="outline" onPress={onPayments} />
          <PrimaryButton label="Actualizar" variant="outline" onPress={load} />
        </View>

        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 6 }}>
          Moderação de Conteúdo
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 24 }}>
          Criadores nunca publicam directamente. Aprovar = published no catálogo.
        </Text>

        {error ? <ErrorState message={error} onRetry={load} /> : null}

        <Text style={{ color: colors.gold, fontWeight: '700', marginBottom: 12 }}>
          Criadores pendentes
        </Text>
        {creators.length === 0 ? (
          <EmptyState title="Sem criadores pendentes" />
        ) : (
          creators.map((creator) => (
            <View key={creator.id} style={cardStyle}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{creator.displayName}</Text>
              <Text style={{ color: colors.muted }}>{creator.email}</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{creator.type}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <PrimaryButton
                  label="Aprovar"
                  variant="gold"
                  loading={busy === creator.id}
                  onPress={async () => {
                    setBusy(creator.id);
                    try {
                      await reviewCreator(creator.id, 'active');
                      await load();
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  label="Rejeitar"
                  variant="outline"
                  onPress={async () => {
                    setBusy(creator.id);
                    try {
                      await reviewCreator(creator.id, 'rejected');
                      await load();
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ))
        )}

        <Text style={{ color: colors.gold, fontWeight: '700', marginTop: 28, marginBottom: 12 }}>
          Conteúdos submetidos
        </Text>
        {contents.length === 0 ? (
          <EmptyState title="Fila de conteúdo vazia" />
        ) : (
          contents.map((item) => (
            <View key={item.id} style={cardStyle}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{item.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>
                {item.creatorDisplayName || 'Criador'} · {item.creatorEmail || '—'}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                {String(item.monetization || '').toUpperCase()}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <PrimaryButton
                  label="Publicar"
                  variant="gold"
                  loading={busy === item.id}
                  onPress={async () => {
                    setBusy(item.id);
                    try {
                      await moderateContent(item.id, { action: 'publish' });
                      await load();
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  label="Rejeitar"
                  variant="outline"
                  onPress={async () => {
                    setBusy(item.id);
                    try {
                      await moderateContent(item.id, {
                        action: 'reject',
                        rejectionReason: 'Não cumpre os critérios editoriais',
                      });
                      await load();
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ))
        )}
      <Text style={{ color: colors.gold, fontWeight: '700', marginTop: 28, marginBottom: 12 }}>
          Payouts de criadores
        </Text>
        {payouts.length === 0 ? (
          <EmptyState title="Sem payouts pendentes" />
        ) : (
          payouts.map((p) => (
            <View key={p.id} style={cardStyle}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {p.displayName} · {p.amountKz.toLocaleString('pt-AO')} Kz
              </Text>
              <Text style={{ color: colors.muted }}>{p.email}</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{p.bankIban}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <PrimaryButton
                  label="Marcar pago"
                  variant="gold"
                  loading={busy === p.id}
                  onPress={async () => {
                    setBusy(p.id);
                    try {
                      await reviewPayout(p.id, { status: 'paid' });
                      await load();
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  label="Rejeitar"
                  variant="outline"
                  onPress={async () => {
                    setBusy(p.id);
                    try {
                      await reviewPayout(p.id, { status: 'rejected', notes: 'Dados bancários inválidos' });
                      await load();
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const cardStyle = {
  backgroundColor: '#111111',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.border,
  padding: 14,
  marginBottom: 12,
};
