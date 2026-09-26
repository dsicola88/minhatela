import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout } from '../theme/tokens';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews';
import Focusable from '../tv/Focusable';
import { listInvoices, getInvoice } from '../services/phase23';
import { getApiBaseUrl } from '../services/api';

export default function Invoices({ onBack }) {
  const insets = useSafeAreaInsets();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await listInvoices();
      setInvoices(res.invoices || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar facturas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openInvoice(inv) {
    try {
      if (Platform.OS === 'web') {
        window.open(`${getApiBaseUrl()}/api/me/invoices/${inv.id}?format=html`, '_blank');
        return;
      }
      const res = await getInvoice(inv.id);
      // native: show summary; HTML via API needs auth header — use JSON details
      alert?.(`${res.invoice.invoiceNumber}\n${res.invoice.amountKz} Kz`);
    } catch {
      /* ignore */
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Focusable id="inv-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginLeft: 16 }}>
          Facturas
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 60,
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />}
      >
        {!invoices.length ? (
          <EmptyState title="Sem facturas" subtitle="Os pagamentos confirmados aparecem aqui." />
        ) : (
          invoices.map((inv) => (
            <Pressable
              key={inv.id}
              onPress={() => openInvoice(inv)}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingVertical: 16,
              }}
            >
              <Text style={{ color: colors.gold, fontWeight: '800', letterSpacing: 1 }}>
                {inv.invoiceNumber}
              </Text>
              <Text style={{ color: colors.text, marginTop: 6, fontWeight: '600' }}>{inv.title}</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>
                {Number(inv.amountKz).toLocaleString('pt-AO')} Kz · {inv.status} ·{' '}
                {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString('pt-AO') : ''}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
