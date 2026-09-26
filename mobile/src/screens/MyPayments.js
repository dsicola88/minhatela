import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Pressable,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import { fetchMyPayments, fetchPaymentReceipt } from '../services/engagement';
import Focusable from '../tv/Focusable';
import { getApiBaseUrl, getAuthToken } from '../services/api';

const STATUS_COLOR = {
  pending: colors.gold,
  paid: '#22C55E',
  rejected: colors.red,
  expired: colors.muted,
};

export default function MyPayments({ onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [receiptMsg, setReceiptMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await fetchMyPayments();
      setItems(data.transactions || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openReceipt(tx) {
    try {
      setReceiptMsg('');
      if (Platform.OS === 'web') {
        const url = `${getApiBaseUrl()}/api/payments/transactions/${tx.id}/receipt?format=html`;
        const token = getAuthToken();
        // Abrir com token via fetch blob (Authorization header)
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/html' },
        });
        const html = await res.text();
        const blob = new Blob([html], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
        return;
      }
      const data = await fetchPaymentReceipt(tx.id);
      setReceiptMsg(`Recibo ${data.receiptNumber} · ${data.amountKz} Kz`);
    } catch (err) {
      setReceiptMsg(err.message || 'Recibo indisponível');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: isCompact ? 16 : 40,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Focusable id="pay-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 16, flex: 1 }}>
          Os meus pagamentos
        </Text>
        <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1 }}>
          {brand.name.toUpperCase()}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.red} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: isCompact ? 16 : 40,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            paddingBottom: 64,
          }}
        >
          {error ? <Text style={{ color: colors.red }}>{error}</Text> : null}
          {receiptMsg ? (
            <Text style={{ color: colors.gold, marginBottom: 12 }}>{receiptMsg}</Text>
          ) : null}
          {!items.length ? (
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 48 }}>
              Ainda não há pagamentos nesta conta.
            </Text>
          ) : (
            items.map((tx) => (
              <View
                key={tx.id}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 6,
                  padding: 16,
                  marginBottom: 12,
                  backgroundColor: colors.elevated,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {tx.type === 'subscription' ? 'Premium' : tx.videoTitle || 'Aluguer'}
                  </Text>
                  <Text
                    style={{
                      color: STATUS_COLOR[tx.status] || colors.textSecondary,
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      fontSize: 12,
                    }}
                  >
                    {tx.status}
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary }}>
                  {tx.amountKz?.toLocaleString('pt-AO')} Kz · {(tx.paymentMethod || '').toUpperCase()}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
                  {new Date(tx.createdAt).toLocaleString('pt-AO')}
                  {tx.accessExpiresAt
                    ? ` · Acesso até ${new Date(tx.accessExpiresAt).toLocaleString('pt-AO')}`
                    : ''}
                </Text>
                <Pressable onPress={() => openReceipt(tx)} style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.gold, fontWeight: '700', fontSize: 13 }}>
                    Ver recibo
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
