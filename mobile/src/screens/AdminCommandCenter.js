import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Linking,
  Modal,
  TextInput,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { colors, brand, layout } from '../theme/tokens';
import {
  fetchCommandCenter,
  fetchAuditLog,
  fetchLiveStreams,
  fetchPendingPayments,
  fetchPendingCreators,
  fetchPendingContent,
  fetchPendingCampaigns,
  reviewPayment,
  reviewCreator,
  moderateContent,
  reviewCampaign,
  resolveProofUrl,
  fetchPromos,
  createPromo,
  setPromoActive,
} from '../services/admin';
import { fetchPendingPayouts, reviewPayout } from '../services/payouts';
import Focusable from '../tv/Focusable';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid-outline' },
  { id: 'payments', label: 'Pagamentos', icon: 'card-outline' },
  { id: 'moderation', label: 'Moderação', icon: 'shield-checkmark-outline' },
  { id: 'promos', label: 'Promos', icon: 'pricetag-outline' },
  { id: 'live', label: 'Live', icon: 'radio-outline' },
  { id: 'audit', label: 'Auditoria', icon: 'document-text-outline' },
];

function Kpi({ label, value, hint, alert }) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 140,
        minWidth: 140,
        backgroundColor: '#0F0F0F',
        borderWidth: 1,
        borderColor: colors.border,
        borderTopWidth: 3,
        borderTopColor: alert ? colors.gold : colors.red,
        borderRadius: 6,
        padding: 14,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6, letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      {hint ? (
        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

function QueueChip({ label, count, onPress }) {
  return (
    <Focusable
      id={`queue-${label}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: count > 0 ? colors.gold : colors.border,
        backgroundColor: count > 0 ? 'rgba(247,212,23,0.08)' : '#111',
        marginRight: 10,
        marginBottom: 10,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
      <View
        style={{
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: count > 0 ? colors.red : colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 6,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 11, fontWeight: '800' }}>{count}</Text>
      </View>
    </Focusable>
  );
}

export default function AdminCommandCenter({ onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [center, setCenter] = useState(null);
  const [payments, setPayments] = useState([]);
  const [creators, setCreators] = useState([]);
  const [contents, setContents] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [streams, setStreams] = useState([]);
  const [audit, setAudit] = useState([]);
  const [promos, setPromos] = useState([]);
  const [promoForm, setPromoForm] = useState({ code: '', days: '7', max: '1000' });
  const [busy, setBusy] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [cc, pay, cr, co, po, ca, live, au, pr] = await Promise.all([
        fetchCommandCenter(),
        fetchPendingPayments(),
        fetchPendingCreators(),
        fetchPendingContent('submitted'),
        fetchPendingPayouts(),
        fetchPendingCampaigns(),
        fetchLiveStreams(),
        fetchAuditLog({ limit: 40 }),
        fetchPromos().catch(() => ({ promos: [] })),
      ]);
      setCenter(cc);
      setPayments(pay.transactions || []);
      setCreators(cr.creators || []);
      setContents(co.contents || []);
      setPayouts(po.payouts || []);
      setCampaigns(ca.campaigns || []);
      setStreams(live.streams || []);
      setAudit(au.items || []);
      setPromos(pr.promos || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar Command Center');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(id, fn) {
    setBusy(id);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <LoadingState />
      </View>
    );
  }

  const kpis = center?.kpis || {};
  const queues = center?.queues || {};

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />

      <View
        style={{
          paddingHorizontal: isCompact ? 16 : 32,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Focusable id="admin-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Focusable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1.2, fontSize: 12 }}>
            {brand.name.toUpperCase()} · OPS
          </Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
            Command Center
          </Text>
        </View>
        {kpis.attentionRequired > 0 ? (
          <View
            style={{
              backgroundColor: colors.gold,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: colors.black, fontWeight: '800', fontSize: 12 }}>
              {kpis.attentionRequired} em fila
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: isCompact ? 16 : 32,
          paddingVertical: 12,
          gap: 8,
        }}
        style={{ maxHeight: 64, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Focusable
              key={item.id}
              id={`tab-${item.id}`}
              onPress={() => setTab(item.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 4,
                backgroundColor: active ? colors.text : 'transparent',
                borderWidth: 1,
                borderColor: active ? colors.text : colors.border,
                marginRight: 8,
              }}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={active ? colors.black : colors.textSecondary}
              />
              <Text
                style={{
                  color: active ? colors.black : colors.textSecondary,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                {item.label}
              </Text>
            </Focusable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{
          padding: isCompact ? 16 : 32,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 80,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.red}
          />
        }
      >
        {error ? <ErrorState message={error} onRetry={load} /> : null}

        {tab === 'overview' ? (
          <View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <Kpi label="UTILIZADORES" value={kpis.users ?? '—'} hint={`${kpis.premiumUsers || 0} Premium`} />
              <Kpi
                label="RECEITA HOJE"
                value={center?.labels?.revenueToday || `${kpis.revenueTodayKz || 0} Kz`}
                hint={`${kpis.paymentsToday || 0} pagamentos`}
              />
              <Kpi label="7 DIAS" value={center?.labels?.revenue7d || '—'} />
              <Kpi
                label="STREAMS LIVE"
                value={kpis.activeStreams ?? 0}
                hint={`${kpis.playsToday || 0} plays hoje`}
                alert={kpis.activeStreams > 0}
              />
              <Kpi label="CATÁLOGO" value={kpis.publishedTitles ?? 0} hint={`${kpis.seriesCount || 0} séries`} />
              <Kpi
                label="ATENÇÃO"
                value={kpis.attentionRequired ?? 0}
                hint="filas abertas"
                alert={kpis.attentionRequired > 0}
              />
            </View>

            <Text style={{ color: colors.gold, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>
              FILAS
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 28 }}>
              <QueueChip label="Pagamentos" count={queues.payments || 0} onPress={() => setTab('payments')} />
              <QueueChip label="Criadores" count={queues.creators || 0} onPress={() => setTab('moderation')} />
              <QueueChip label="Conteúdo" count={queues.content || 0} onPress={() => setTab('moderation')} />
              <QueueChip label="Payouts" count={queues.payouts || 0} onPress={() => setTab('moderation')} />
              <QueueChip label="Campanhas" count={queues.campaigns || 0} onPress={() => setTab('moderation')} />
            </View>

            <Text style={{ color: colors.gold, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>
              AUDITORIA RECENTE
            </Text>
            {(center?.recentAudit || []).length === 0 ? (
              <EmptyState title="Sem eventos de auditoria" />
            ) : (
              center.recentAudit.map((item) => <AuditRow key={item.id} item={item} />)
            )}
          </View>
        ) : null}

        {tab === 'payments' ? (
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
              Pagamentos pendentes
            </Text>
            <Text style={{ color: colors.muted, marginBottom: 20 }}>
              Confirmação manual IBAN / Multicaixa — dispara notificação ao cliente.
            </Text>
            {payments.length === 0 ? (
              <EmptyState title="Fila limpa" subtitle="Nenhum comprovativo à espera." />
            ) : (
              payments.map((tx) => (
                <View key={tx.id} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {tx.fullName} · {tx.email}
                  </Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                    {tx.type === 'subscription' ? 'Premium' : tx.videoTitle || 'Aluguer'} ·{' '}
                    {tx.amountKz?.toLocaleString('pt-AO')} Kz · {(tx.paymentMethod || '').toUpperCase()}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                    {new Date(tx.createdAt).toLocaleString('pt-AO')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                    {tx.proofUrl ? (
                      <PrimaryButton
                        label="Comprovativo"
                        variant="outline"
                        onPress={() => Linking.openURL(resolveProofUrl(tx.proofUrl))}
                      />
                    ) : null}
                    <PrimaryButton
                      label={busy === tx.id ? '…' : 'Aprovar'}
                      onPress={() =>
                        run(tx.id, () => reviewPayment(tx.id, { status: 'pago' }))
                      }
                      disabled={busy === tx.id}
                    />
                    <PrimaryButton
                      label="Rejeitar"
                      variant="outline"
                      onPress={() => {
                        setRejectTarget({ type: 'payment', id: tx.id });
                        setRejectReason('');
                      }}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'moderation' ? (
          <View>
            <SectionTitle>Criadores</SectionTitle>
            {creators.length === 0 ? (
              <EmptyState title="Sem criadores pendentes" />
            ) : (
              creators.map((c) => (
                <View key={c.id} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{c.displayName}</Text>
                  <Text style={{ color: colors.muted }}>{c.email} · {c.type}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <PrimaryButton
                      label="Activar"
                      onPress={() => run(c.id, () => reviewCreator(c.id, 'active'))}
                    />
                    <PrimaryButton
                      label="Rejeitar"
                      variant="outline"
                      onPress={() => run(c.id, () => reviewCreator(c.id, 'rejected'))}
                    />
                  </View>
                </View>
              ))
            )}

            <SectionTitle>Conteúdo submetido</SectionTitle>
            {contents.length === 0 ? (
              <EmptyState title="Sem conteúdos em revisão" />
            ) : (
              contents.map((item) => (
                <View key={item.id} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
                  <Text style={{ color: colors.muted }}>{item.workflowStatus || item.status}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <PrimaryButton
                      label="Publicar"
                      onPress={() =>
                        run(item.id, () => moderateContent(item.id, { action: 'publish' }))
                      }
                    />
                    <PrimaryButton
                      label="Rejeitar"
                      variant="outline"
                      onPress={() =>
                        run(item.id, () =>
                          moderateContent(item.id, {
                            action: 'reject',
                            rejectionReason: 'Não cumpre guidelines',
                          })
                        )
                      }
                    />
                  </View>
                </View>
              ))
            )}

            <SectionTitle>Payouts criadores</SectionTitle>
            {payouts.length === 0 ? (
              <EmptyState title="Sem payouts pendentes" />
            ) : (
              payouts.map((p) => (
                <View key={p.id} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {p.displayName || p.creatorName} · {p.amountKz?.toLocaleString('pt-AO')} Kz
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <PrimaryButton
                      label="Pagar"
                      onPress={() => run(p.id, () => reviewPayout(p.id, { status: 'paid' }))}
                    />
                    <PrimaryButton
                      label="Rejeitar"
                      variant="outline"
                      onPress={() => run(p.id, () => reviewPayout(p.id, { status: 'rejected' }))}
                    />
                  </View>
                </View>
              ))
            )}

            <SectionTitle>Campanhas ads</SectionTitle>
            {campaigns.length === 0 ? (
              <EmptyState title="Sem campanhas em review" />
            ) : (
              campaigns.map((c) => (
                <View key={c.id} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{c.name}</Text>
                  <Text style={{ color: colors.muted }}>
                    {c.companyName} · {c.placement} · {c.budgetKz?.toLocaleString('pt-AO')} Kz
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <PrimaryButton
                      label="Activar"
                      onPress={() => run(c.id, () => reviewCampaign(c.id, 'active'))}
                    />
                    <PrimaryButton
                      label="Rejeitar"
                      variant="outline"
                      onPress={() => run(c.id, () => reviewCampaign(c.id, 'rejected'))}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'promos' ? (
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
              Códigos promocionais
            </Text>
            <Text style={{ color: colors.muted, marginBottom: 16 }}>
              Resgate concede dias Premium. Seed: ANGOLA7.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              <TextInput
                value={promoForm.code}
                onChangeText={(code) => setPromoForm((f) => ({ ...f, code }))}
                placeholder="CÓDIGO"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                style={{
                  minWidth: 140,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  padding: 10,
                  borderRadius: 4,
                }}
              />
              <TextInput
                value={promoForm.days}
                onChangeText={(days) => setPromoForm((f) => ({ ...f, days }))}
                placeholder="Dias"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={{
                  width: 80,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  padding: 10,
                  borderRadius: 4,
                }}
              />
              <TextInput
                value={promoForm.max}
                onChangeText={(max) => setPromoForm((f) => ({ ...f, max }))}
                placeholder="Máx."
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={{
                  width: 90,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  padding: 10,
                  borderRadius: 4,
                }}
              />
              <PrimaryButton
                label={busy === 'promo-create' ? '…' : 'Criar'}
                onPress={() =>
                  run('promo-create', async () => {
                    await createPromo({
                      code: promoForm.code,
                      valueInt: Number(promoForm.days) || 7,
                      maxRedemptions: Number(promoForm.max) || null,
                      kind: 'premium_days',
                      description: `Campanha ${promoForm.code}`,
                    });
                    setPromoForm({ code: '', days: '7', max: '1000' });
                  })
                }
              />
            </View>
            {promos.length === 0 ? (
              <EmptyState title="Sem códigos" subtitle="Crie o primeiro código de campanha." />
            ) : (
              promos.map((p) => (
                <View key={p.id} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '800', letterSpacing: 1 }}>
                    {p.code}
                  </Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                    {p.valueInt} dias · {p.redemptionCount}
                    {p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : ''} resgates ·{' '}
                    {p.isActive ? 'activo' : 'inactivo'}
                  </Text>
                  {p.description ? (
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                      {p.description}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <PrimaryButton
                      label={p.isActive ? 'Desactivar' : 'Activar'}
                      variant="outline"
                      onPress={() =>
                        run(`promo-${p.id}`, () => setPromoActive(p.id, !p.isActive))
                      }
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'live' ? (
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
              Streams activos
            </Text>
            <Text style={{ color: colors.muted, marginBottom: 20 }}>
              Heartbeat &lt; 90s · limites Free/Premium aplicados no play gate.
            </Text>
            {streams.length === 0 ? (
              <EmptyState title="Ninguém a assistir agora" />
            ) : (
              streams.map((s) => (
                <View key={s.sessionId} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{s.contentTitle}</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                    {s.email} · {s.deviceName || 'Dispositivo'} ({s.platform || '—'})
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                    Heartbeat {new Date(s.lastHeartbeatAt).toLocaleTimeString('pt-AO')}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'audit' ? (
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
              Trilha de auditoria
            </Text>
            <Text style={{ color: colors.muted, marginBottom: 20 }}>
              Acções privilegiadas com actor, IP e timestamp.
            </Text>
            {audit.length === 0 ? (
              <EmptyState title="Sem registos" />
            ) : (
              audit.map((item) => <AuditRow key={item.id} item={item} />)
            )}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(rejectTarget)} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.85)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.elevated,
              borderRadius: 8,
              padding: 20,
              borderWidth: 1,
              borderColor: colors.border,
              maxWidth: 420,
              width: '100%',
              alignSelf: 'center',
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
              Motivo da rejeição
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Ex.: comprovativo ilegível"
              placeholderTextColor={colors.muted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                padding: 12,
                marginBottom: 16,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PrimaryButton label="Cancelar" variant="outline" onPress={() => setRejectTarget(null)} />
              <PrimaryButton
                label="Confirmar"
                onPress={() => {
                  const target = rejectTarget;
                  setRejectTarget(null);
                  if (target?.type === 'payment') {
                    run(target.id, () =>
                      reviewPayment(target.id, {
                        status: 'rejeitado',
                        adminNotes: rejectReason || 'Rejeitado',
                      })
                    );
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionTitle({ children }) {
  return (
    <Text
      style={{
        color: colors.gold,
        fontWeight: '700',
        letterSpacing: 1,
        marginTop: 8,
        marginBottom: 12,
      }}
    >
      {children}
    </Text>
  );
}

function AuditRow({ item }) {
  return (
    <View
      style={{
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '700' }}>{item.action}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
        {item.entity}
        {item.actor?.email ? ` · ${item.actor.email}` : ''}
        {item.ip ? ` · ${item.ip}` : ''}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
        {new Date(item.createdAt).toLocaleString('pt-AO')}
      </Text>
    </View>
  );
}

const cardStyle = {
  backgroundColor: '#111',
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 6,
  padding: 16,
  marginBottom: 12,
};
