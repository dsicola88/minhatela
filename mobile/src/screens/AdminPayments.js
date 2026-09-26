import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Linking,
  useWindowDimensions,
  Modal,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../components/ui';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { colors, layout } from '../theme/tokens';
import {
  fetchAdminDashboard,
  fetchPendingPayments,
  reviewPayment,
  resolveProofUrl,
} from '../services/admin';
import { fetchPaymentRisk, fetchEncodingQueue, updateEncoding } from '../services/phase25';
import { t } from '../i18n/pt';

function StatCard({ label, value, accent }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 140,
        backgroundColor: '#111111',
        borderWidth: 1,
        borderColor: colors.border,
        borderTopWidth: 2,
        borderTopColor: accent || colors.red,
        borderRadius: 6,
        padding: 16,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

export default function AdminPayments({ onBack }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [riskItems, setRiskItems] = useState([]);
  const [encoding, setEncoding] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [dash, pending, risk, enc] = await Promise.all([
        fetchAdminDashboard(),
        fetchPendingPayments(),
        fetchPaymentRisk(40).catch(() => ({ items: [] })),
        fetchEncodingQueue().catch(() => ({ items: [] })),
      ]);
      setDashboard(dash);
      setTransactions(pending.transactions || []);
      setRiskItems(risk.items || []);
      setEncoding(enc.items || []);
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id) {
    setBusyId(id);
    try {
      await reviewPayment(id, { status: 'paid' });
      await load();
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await reviewPayment(rejectTarget.id, {
        status: 'rejected',
        adminNotes: rejectReason || 'Comprovativo inválido',
      });
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  }

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
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={{ color: colors.textSecondary }}>Voltar à Home</Text>
        </Pressable>

        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 6 }}>
          Operations · Pagamentos
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 24 }}>
          Confirmação administrativa IBAN / Multicaixa. Só `pago` liberta Premium ou aluguer 48h.
        </Text>

        {dashboard ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
            <StatCard label="Utilizadores" value={dashboard.users} />
            <StatCard label="Pendentes" value={dashboard.pendingPayments} accent={colors.gold} />
            <StatCard
              label="Receita hoje (Kz)"
              value={Number(dashboard.revenueTodayKz).toLocaleString('pt-AO')}
              accent={colors.gold}
            />
            <StatCard label="Conteúdos" value={dashboard.publishedContent} />
          </View>
        ) : null}

        {error ? <ErrorState message={error} onRetry={load} /> : null}

        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 14 }}>
          {t('adminPayments')}
        </Text>

        {transactions.length === 0 ? (
          <EmptyState
            title="Sem pagamentos pendentes"
            subtitle="Novos comprovativos aparecerão aqui para revisão."
          />
        ) : (
          transactions.map((tx) => {
            const proof = resolveProofUrl(tx.proofUrl);
            const isImage = proof && /\.(jpg|jpeg|png|webp)$/i.test(proof);
            return (
              <View
                key={tx.id}
                style={{
                  backgroundColor: '#111111',
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 14,
                }}
              >
                <View
                  style={{
                    flexDirection: isCompact ? 'column' : 'row',
                    gap: 16,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                      {String(tx.type || '').toUpperCase()} · {Number(tx.amountKz).toLocaleString('pt-AO')} Kz
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                      {tx.fullName}
                    </Text>
                    <Text style={{ color: colors.muted, marginBottom: 8 }}>{tx.email}</Text>
                    <Text style={{ color: colors.textSecondary }}>
                      {tx.videoTitle || 'Assinatura Premium'}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
                      Método: {tx.paymentMethod} · {new Date(tx.createdAt).toLocaleString('pt-AO')}
                      {tx.riskScore > 0
                        ? ` · Risco ${tx.riskScore}${tx.riskDecision ? ` (${tx.riskDecision})` : ''}`
                        : ''}
                    </Text>
                  </View>

                  <View style={{ width: isCompact ? '100%' : 180, alignItems: 'center' }}>
                    {isImage ? (
                      <Image
                        source={{ uri: proof }}
                        style={{ width: '100%', height: 120, borderRadius: 4, backgroundColor: '#181818' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: '100%',
                          height: 120,
                          borderRadius: 4,
                          backgroundColor: '#181818',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Ionicons name="document-text" size={28} color={colors.gold} />
                      </View>
                    )}
                    <Pressable onPress={() => proof && Linking.openURL(proof)} style={{ marginTop: 8 }}>
                      <Text style={{ color: colors.gold, fontWeight: '600' }}>{t('viewProof')}</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <PrimaryButton
                    label={t('approve')}
                    variant="gold"
                    loading={busyId === tx.id}
                    onPress={() => approve(tx.id)}
                    style={{ flex: 1 }}
                  />
                  <PrimaryButton
                    label={t('reject')}
                    variant="outline"
                    disabled={busyId === tx.id}
                    onPress={() => setRejectTarget(tx)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            );
          })
        )}

        {riskItems.length ? (
          <View style={{ marginTop: 32 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 14 }}>
              Fila de risco · Fraude
            </Text>
            {riskItems.map((item) => (
              <View
                key={`risk-${item.id}`}
                style={{
                  borderWidth: 1,
                  borderColor: item.riskScore >= 60 ? colors.red : colors.gold,
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 10,
                  backgroundColor: '#111111',
                }}
              >
                <Text style={{ color: colors.gold, fontWeight: '800' }}>
                  Score {item.riskScore} · {item.riskDecision}
                </Text>
                <Text style={{ color: colors.text, marginTop: 4 }}>
                  {item.fullName} · {item.email}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  {item.videoTitle || 'Premium'} · {Number(item.amountKz).toLocaleString('pt-AO')} Kz
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ marginTop: 32 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 14 }}>
            Encoding Bunny
          </Text>
          {encoding.length === 0 ? (
            <EmptyState title="Fila limpa" subtitle="Sem assets em processing/failed." />
          ) : (
            encoding.map((item) => (
              <View
                key={item.id}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 10,
                  backgroundColor: '#111111',
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  {item.kind} · {item.encodingStatus}
                  {item.encodingError ? ` · ${item.encodingError}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <Pressable
                    onPress={async () => {
                      try {
                        await updateEncoding(item.id, { encodingStatus: 'ready' });
                        await load();
                      } catch (err) {
                        setError(err.message || 'Falha');
                      }
                    }}
                  >
                    <Text style={{ color: colors.gold, fontWeight: '700' }}>Marcar ready</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      try {
                        await updateEncoding(item.id, {
                          encodingStatus: 'processing',
                          encodingError: null,
                        });
                        await load();
                      } catch (err) {
                        setError(err.message || 'Falha');
                      }
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Retry</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={Boolean(rejectTarget)} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: '#111111',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 20,
              maxWidth: 480,
              width: '100%',
              alignSelf: 'center',
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              Rejeitar pagamento
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Motivo da rejeição"
              placeholderTextColor={colors.muted}
              multiline
              style={{
                minHeight: 90,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 4,
                color: colors.text,
                padding: 12,
                backgroundColor: '#181818',
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <PrimaryButton
                label="Cancelar"
                variant="outline"
                onPress={() => setRejectTarget(null)}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label={t('reject')}
                onPress={reject}
                loading={busyId === rejectTarget?.id}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
