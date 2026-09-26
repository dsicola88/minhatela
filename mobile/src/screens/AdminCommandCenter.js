import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Linking,
  Modal,
  TextInput,
  Switch,
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
  fetchTickets,
  reviewTicket,
  fetchHelpArticles,
  upsertHelpArticle,
  publishHelpArticle,
  fetchFeatureFlags,
  setFeatureFlag,
  fetchEditorial,
  createEditorial,
  updateEditorial,
  fetchAppConfig,
  upsertAppConfig,
  fetchAdminPacks,
  fetchSurveySummary,
  fetchAdminPremieres,
  fetchAdminGifts,
  createGift,
  revokeGift,
  probeCdn,
  fetchCdnHealth,
  fetchEncoding,
  fetchPaymentRisk,
  fetchExperiments,
  fetchUsers,
  fetchAdminPlans,
  fetchLeads,
  fetchUploads,
  fetchProofUploads,
  uploadAdminMedia,
  fetchAllAdCampaigns,
} from '../services/admin';
import { fetchPendingPayouts, reviewPayout } from '../services/payouts';
import Focusable from '../tv/Focusable';
import {
  LandingPaymentsTab,
  UsersTab,
  PlansTab,
  LeadsTab,
  UploadsTab,
  AdsTab,
} from './AdminEnterpriseSections';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid-outline' },
  { id: 'landing', label: 'Landing / Pay', icon: 'color-palette-outline' },
  { id: 'payments', label: 'Pagamentos', icon: 'card-outline' },
  { id: 'users', label: 'Utilizadores', icon: 'people-outline' },
  { id: 'plans', label: 'Planos', icon: 'pricetags-outline' },
  { id: 'leads', label: 'Leads', icon: 'mail-outline' },
  { id: 'support', label: 'Atendimento', icon: 'headset-outline' },
  { id: 'moderation', label: 'Moderação', icon: 'shield-checkmark-outline' },
  { id: 'ads', label: 'Anúncios', icon: 'megaphone-outline' },
  { id: 'uploads', label: 'Uploads', icon: 'cloud-upload-outline' },
  { id: 'editorial', label: 'Editorial', icon: 'albums-outline' },
  { id: 'flags', label: 'Flags', icon: 'toggle-outline' },
  { id: 'config', label: 'Config / Onboard', icon: 'settings-outline' },
  { id: 'media', label: 'CDN / Encode', icon: 'cloud-outline' },
  { id: 'catalog', label: 'Catálogo ops', icon: 'film-outline' },
  { id: 'promos', label: 'Promos', icon: 'pricetag-outline' },
  { id: 'live', label: 'Live', icon: 'radio-outline' },
  { id: 'audit', label: 'Auditoria', icon: 'document-text-outline' },
];

const cardStyle = {
  backgroundColor: '#111',
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 6,
  padding: 16,
  marginBottom: 12,
};

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
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
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

function inputStyle(extra = {}) {
  return {
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: 10,
    borderRadius: 4,
    marginBottom: 10,
    ...extra,
  };
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
  const [tickets, setTickets] = useState([]);
  const [articles, setArticles] = useState([]);
  const [flags, setFlags] = useState([]);
  const [collections, setCollections] = useState([]);
  const [settings, setSettings] = useState([]);
  const [packs, setPacks] = useState([]);
  const [surveys, setSurveys] = useState(null);
  const [premieres, setPremieres] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [cdn, setCdn] = useState(null);
  const [encoding, setEncoding] = useState([]);
  const [risk, setRisk] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [users, setUsers] = useState([]);
  const [adminPlans, setAdminPlans] = useState([]);
  const [leads, setLeads] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [allAds, setAllAds] = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [promoForm, setPromoForm] = useState({ code: '', days: '7', max: '1000' });
  const [articleForm, setArticleForm] = useState({
    slug: '',
    title: '',
    category: 'geral',
    bodyMd: '',
  });
  const [editorialForm, setEditorialForm] = useState({ slug: '', title: '', subtitle: '' });
  const [giftForm, setGiftForm] = useState({ email: '', days: '30', note: '' });
  const [configDrafts, setConfigDrafts] = useState({});
  const [busy, setBusy] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [ticketNotes, setTicketNotes] = useState({});

  const load = useCallback(async () => {
    try {
      setError('');
      const [
        cc,
        pay,
        cr,
        co,
        po,
        ca,
        live,
        au,
        pr,
        tk,
        art,
        fl,
        ed,
        cfg,
        pk,
        sv,
        pm,
        gf,
        cd,
        enc,
        rk,
        ex,
        us,
        pl,
        ld,
        up,
        pf,
        adsAll,
      ] = await Promise.all([
        fetchCommandCenter(),
        fetchPendingPayments(),
        fetchPendingCreators(),
        fetchPendingContent('submitted'),
        fetchPendingPayouts(),
        fetchPendingCampaigns(),
        fetchLiveStreams(),
        fetchAuditLog({ limit: 40 }),
        fetchPromos().catch(() => ({ promos: [] })),
        fetchTickets(50).catch(() => ({ tickets: [] })),
        fetchHelpArticles().catch(() => ({ articles: [] })),
        fetchFeatureFlags().catch(() => ({ flags: [] })),
        fetchEditorial().catch(() => ({ collections: [] })),
        fetchAppConfig().catch(() => ({ settings: [] })),
        fetchAdminPacks().catch(() => ({ packs: [] })),
        fetchSurveySummary().catch(() => null),
        fetchAdminPremieres().catch(() => ({ events: [] })),
        fetchAdminGifts().catch(() => ({ gifts: [] })),
        fetchCdnHealth().catch(() => null),
        fetchEncoding().catch(() => ({ items: [] })),
        fetchPaymentRisk(0).catch(() => ({ transactions: [] })),
        fetchExperiments().catch(() => ({ experiments: [] })),
        fetchUsers({ limit: 40 }).catch(() => ({ users: [] })),
        fetchAdminPlans().catch(() => ({ plans: [] })),
        fetchLeads({ limit: 50 }).catch(() => ({ leads: [] })),
        fetchUploads({ limit: 40 }).catch(() => ({ uploads: [] })),
        fetchProofUploads(40).catch(() => ({ proofs: [] })),
        fetchAllAdCampaigns({}).catch(() => ({ campaigns: [] })),
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
      setTickets(tk.tickets || []);
      setArticles(art.articles || []);
      setFlags(fl.flags || []);
      setCollections(ed.collections || []);
      setSettings(cfg.settings || []);
      setPacks(pk.packs || pk.items || []);
      setSurveys(sv);
      setPremieres(pm.events || pm.premieres || []);
      setGifts(gf.gifts || []);
      setCdn(cd);
      setEncoding(enc.items || enc.queue || []);
      setRisk(rk.transactions || rk.items || []);
      setExperiments(ex.experiments || ex.items || []);
      setUsers(us.users || []);
      setAdminPlans(pl.plans || []);
      setLeads(ld.leads || []);
      setUploads(up.uploads || []);
      setProofs(pf.proofs || []);
      setAllAds(adsAll.campaigns || []);
      const drafts = {};
      (cfg.settings || []).forEach((s) => {
        drafts[s.key] = JSON.stringify(s.value || {}, null, 2);
      });
      setConfigDrafts(drafts);
    } catch (err) {
      setError(err.message || 'Falha ao carregar Console Empresa');
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
            {brand.name.toUpperCase()} · EMPRESA
          </Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
            Console de Gestão
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
              FILAS OPERACIONAIS
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 28 }}>
              <QueueChip label="Pagamentos" count={queues.payments || 0} onPress={() => setTab('payments')} />
              <QueueChip label="Atendimento" count={queues.tickets || 0} onPress={() => setTab('support')} />
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

        {tab === 'landing' ? (
          <LandingPaymentsTab
            settings={settings}
            configDrafts={configDrafts}
            setConfigDrafts={setConfigDrafts}
            run={run}
            busy={busy}
          />
        ) : null}

        {tab === 'users' ? (
          <UsersTab
            users={users}
            userQuery={userQuery}
            setUserQuery={setUserQuery}
            onSearch={() =>
              run('users-search', async () => {
                const r = await fetchUsers({ q: userQuery, limit: 40 });
                setUsers(r.users || []);
              })
            }
            run={run}
          />
        ) : null}

        {tab === 'plans' ? <PlansTab plans={adminPlans} run={run} busy={busy} /> : null}

        {tab === 'leads' ? <LeadsTab leads={leads} run={run} /> : null}

        {tab === 'ads' ? <AdsTab campaigns={allAds} run={run} /> : null}

        {tab === 'uploads' ? (
          <UploadsTab
            uploads={uploads}
            proofs={proofs}
            busy={busy}
            onPickUpload={() =>
              run('upload', async () => {
                if (typeof document === 'undefined') {
                  throw new Error('Upload de ficheiro disponível na versão Web do Console.');
                }
                await new Promise((resolve, reject) => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*,video/*,application/pdf';
                  input.onchange = async () => {
                    try {
                      const file = input.files?.[0];
                      if (!file) return resolve();
                      await uploadAdminMedia(file, 'landing');
                      resolve();
                    } catch (err) {
                      reject(err);
                    }
                  };
                  input.click();
                });
              })
            }
          />
        ) : null}

        {tab === 'payments' ? (
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
              Pagamentos pendentes
            </Text>
            <Text style={{ color: colors.muted, marginBottom: 20 }}>
              Confirmação manual IBAN / Multicaixa — dispara entitlement e notificação.
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
                    {tx.type === 'subscription'
                      ? 'Premium'
                      : tx.type === 'pack'
                        ? `Pack · ${tx.packSlug || tx.videoTitle || 'TVOD'}`
                        : tx.videoTitle || 'Aluguer'}{' '}
                    · {tx.amountKz?.toLocaleString('pt-AO')} Kz · {(tx.paymentMethod || '').toUpperCase()}
                  </Text>
                  {tx.riskScore != null ? (
                    <Text style={{ color: tx.riskScore >= 70 ? colors.gold : colors.muted, marginTop: 4 }}>
                      Risco {tx.riskScore}
                    </Text>
                  ) : null}
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
                      onPress={() => run(tx.id, () => reviewPayment(tx.id, { status: 'pago' }))}
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

            <SectionTitle>Fila de risco</SectionTitle>
            {risk.length === 0 ? (
              <EmptyState title="Sem alertas de risco" />
            ) : (
              risk.slice(0, 12).map((tx) => (
                <View key={`risk-${tx.id}`} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {tx.email || tx.fullName || tx.id}
                  </Text>
                  <Text style={{ color: colors.gold }}>Score {tx.riskScore ?? tx.risk_score ?? '—'}</Text>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'support' ? (
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
              Atendimento
            </Text>
            <Text style={{ color: colors.muted, marginBottom: 20 }}>
              Tickets de suporte e artigos do Centro de Ajuda.
            </Text>

            <SectionTitle>Tickets abertos</SectionTitle>
            {tickets.length === 0 ? (
              <EmptyState title="Sem tickets em aberto" />
            ) : (
              tickets.map((t) => (
                <View key={t.id} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{t.subject}</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                    {t.fullName} · {t.email} · {t.category} · {t.priority}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 8 }}>{t.body}</Text>
                  <TextInput
                    value={ticketNotes[t.id] || ''}
                    onChangeText={(v) => setTicketNotes((m) => ({ ...m, [t.id]: v }))}
                    placeholder="Notas internas"
                    placeholderTextColor={colors.muted}
                    style={inputStyle({ marginTop: 12 })}
                  />
                  <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <PrimaryButton
                      label="Em progresso"
                      variant="outline"
                      onPress={() =>
                        run(`tk-${t.id}`, () =>
                          reviewTicket(t.id, {
                            status: 'in_progress',
                            adminNotes: ticketNotes[t.id] || undefined,
                          })
                        )
                      }
                    />
                    <PrimaryButton
                      label="Resolver"
                      onPress={() =>
                        run(`tk-r-${t.id}`, () =>
                          reviewTicket(t.id, {
                            status: 'resolved',
                            adminNotes: ticketNotes[t.id] || 'Resolvido',
                          })
                        )
                      }
                    />
                    <PrimaryButton
                      label="Fechar"
                      variant="outline"
                      onPress={() =>
                        run(`tk-c-${t.id}`, () =>
                          reviewTicket(t.id, {
                            status: 'closed',
                            adminNotes: ticketNotes[t.id] || undefined,
                          })
                        )
                      }
                    />
                  </View>
                </View>
              ))
            )}

            <SectionTitle>FAQ / Artigos</SectionTitle>
            <View style={cardStyle}>
              <TextInput
                value={articleForm.slug}
                onChangeText={(slug) => setArticleForm((f) => ({ ...f, slug }))}
                placeholder="slug"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={inputStyle()}
              />
              <TextInput
                value={articleForm.title}
                onChangeText={(title) => setArticleForm((f) => ({ ...f, title }))}
                placeholder="Título"
                placeholderTextColor={colors.muted}
                style={inputStyle()}
              />
              <TextInput
                value={articleForm.category}
                onChangeText={(category) => setArticleForm((f) => ({ ...f, category }))}
                placeholder="Categoria"
                placeholderTextColor={colors.muted}
                style={inputStyle()}
              />
              <TextInput
                value={articleForm.bodyMd}
                onChangeText={(bodyMd) => setArticleForm((f) => ({ ...f, bodyMd }))}
                placeholder="Corpo (markdown)"
                placeholderTextColor={colors.muted}
                multiline
                style={inputStyle({ minHeight: 100, textAlignVertical: 'top' })}
              />
              <PrimaryButton
                label={busy === 'article-create' ? '…' : 'Publicar artigo'}
                onPress={() =>
                  run('article-create', async () => {
                    await upsertHelpArticle(articleForm);
                    setArticleForm({ slug: '', title: '', category: 'geral', bodyMd: '' });
                  })
                }
              />
            </View>
            {articles.map((a) => (
              <View key={a.id} style={cardStyle}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{a.title}</Text>
                <Text style={{ color: colors.muted }}>
                  {a.slug} · {a.category} · {a.isPublished ? 'publicado' : 'rascunho'}
                </Text>
                <View style={{ marginTop: 10 }}>
                  <PrimaryButton
                    label={a.isPublished ? 'Despublicar' : 'Publicar'}
                    variant="outline"
                    onPress={() =>
                      run(`art-${a.id}`, () => publishHelpArticle(a.id, !a.isPublished))
                    }
                  />
                </View>
              </View>
            ))}
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
                  <Text style={{ color: colors.muted }}>
                    {c.email} · {c.type}
                  </Text>
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

        {tab === 'editorial' ? (
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
              Colecções editoriais
            </Text>
            <Text style={{ color: colors.muted, marginBottom: 16 }}>
              Controlam filas da Home (estilo Netflix rows).
            </Text>
            <View style={cardStyle}>
              <TextInput
                value={editorialForm.slug}
                onChangeText={(slug) => setEditorialForm((f) => ({ ...f, slug }))}
                placeholder="slug"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={inputStyle()}
              />
              <TextInput
                value={editorialForm.title}
                onChangeText={(title) => setEditorialForm((f) => ({ ...f, title }))}
                placeholder="Título da fila"
                placeholderTextColor={colors.muted}
                style={inputStyle()}
              />
              <TextInput
                value={editorialForm.subtitle}
                onChangeText={(subtitle) => setEditorialForm((f) => ({ ...f, subtitle }))}
                placeholder="Subtítulo"
                placeholderTextColor={colors.muted}
                style={inputStyle()}
              />
              <PrimaryButton
                label="Criar colecção"
                onPress={() =>
                  run('ed-create', async () => {
                    await createEditorial(editorialForm);
                    setEditorialForm({ slug: '', title: '', subtitle: '' });
                  })
                }
              />
            </View>
            {collections.length === 0 ? (
              <EmptyState title="Sem colecções" />
            ) : (
              collections.map((c) => (
                <View key={c.id} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{c.title}</Text>
                  <Text style={{ color: colors.muted }}>
                    {c.slug} · {c.placement || 'home'} ·{' '}
                    {c.isPublished !== false ? 'publicada' : 'rascunho'}
                  </Text>
                  <View style={{ marginTop: 10 }}>
                    <PrimaryButton
                      label={c.isPublished === false ? 'Publicar' : 'Despublicar'}
                      variant="outline"
                      onPress={() =>
                        run(`ed-${c.id}`, () =>
                          updateEditorial(c.id, { isPublished: c.isPublished === false })
                        )
                      }
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'flags' ? (
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
              Feature flags
            </Text>
            <Text style={{ color: colors.muted, marginBottom: 16 }}>
              Ligar/desligar capacidades da app sem deploy.
            </Text>
            {flags.length === 0 ? (
              <EmptyState title="Sem flags" />
            ) : (
              flags.map((f) => (
                <View
                  key={f.key}
                  style={{
                    ...cardStyle,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{f.key}</Text>
                    <Text style={{ color: colors.muted, marginTop: 4 }}>
                      {f.description || '—'}
                    </Text>
                  </View>
                  <Switch
                    value={Boolean(f.enabled)}
                    onValueChange={(enabled) =>
                      run(`flag-${f.key}`, () => setFeatureFlag(f.key, enabled))
                    }
                    trackColor={{ false: colors.border, true: colors.red }}
                    thumbColor={colors.text}
                  />
                </View>
              ))
            )}

            <SectionTitle>Experiências A/B</SectionTitle>
            {experiments.length === 0 ? (
              <EmptyState title="Sem experiências activas" />
            ) : (
              experiments.map((e, idx) => (
                <View key={e.key || e.id || idx} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {e.key || e.name || e.id}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {typeof e === 'object' ? JSON.stringify(e).slice(0, 120) : String(e)}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'config' ? (
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
              Configuração & Onboarding
            </Text>
            <Text style={{ color: colors.muted, marginBottom: 16 }}>
              Onboarding, contactos de suporte e mensagens de marca. Exposto em GET /api/app/config.
            </Text>
            {settings.length === 0 ? (
              <EmptyState title="Sem settings" subtitle="Corra a migração 025." />
            ) : (
              settings.map((s) => (
                <View key={s.key} style={cardStyle}>
                  <Text style={{ color: colors.gold, fontWeight: '800', letterSpacing: 1 }}>
                    {s.key.toUpperCase()}
                  </Text>
                  {s.description ? (
                    <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 8 }}>
                      {s.description}
                    </Text>
                  ) : null}
                  <TextInput
                    value={configDrafts[s.key] ?? ''}
                    onChangeText={(v) => setConfigDrafts((d) => ({ ...d, [s.key]: v }))}
                    multiline
                    autoCapitalize="none"
                    style={inputStyle({
                      minHeight: 140,
                      fontFamily: 'monospace',
                      textAlignVertical: 'top',
                    })}
                  />
                  <PrimaryButton
                    label={busy === `cfg-${s.key}` ? '…' : 'Guardar'}
                    onPress={() =>
                      run(`cfg-${s.key}`, async () => {
                        let parsed;
                        try {
                          parsed = JSON.parse(configDrafts[s.key] || '{}');
                        } catch {
                          throw new Error(`JSON inválido em ${s.key}`);
                        }
                        await upsertAppConfig(s.key, parsed, s.description);
                      })
                    }
                  />
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'media' ? (
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
              CDN / Encoding
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <PrimaryButton
                label={busy === 'cdn-probe' ? 'A testar…' : 'Probe CDN'}
                onPress={() =>
                  run('cdn-probe', async () => {
                    const r = await probeCdn();
                    setCdn(r);
                  })
                }
              />
            </View>
            <View style={cardStyle}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Estado Bunny / CDN</Text>
              <Text style={{ color: colors.muted, marginTop: 8 }}>
                {cdn
                  ? JSON.stringify(cdn, null, 2).slice(0, 800)
                  : 'Sem dados — execute Probe CDN.'}
              </Text>
            </View>
            <SectionTitle>Fila de encoding</SectionTitle>
            {encoding.length === 0 ? (
              <EmptyState title="Fila vazia ou encoding desactivado" />
            ) : (
              encoding.slice(0, 30).map((item) => (
                <View key={item.id || item.contentId} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {item.title || item.contentId || item.id}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {item.status || item.encodingStatus || '—'}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'catalog' ? (
          <View>
            <SectionTitle>Packs TVOD</SectionTitle>
            {packs.length === 0 ? (
              <EmptyState title="Sem packs" />
            ) : (
              packs.map((p) => (
                <View key={p.id || p.slug} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {p.title || p.name || p.slug}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {p.slug} · {p.priceKz?.toLocaleString?.('pt-AO') || p.price_kz || '—'} Kz ·{' '}
                    {p.isActive !== false ? 'activo' : 'inactivo'}
                  </Text>
                </View>
              ))
            )}

            <SectionTitle>NPS / Surveys</SectionTitle>
            <View style={cardStyle}>
              <Text style={{ color: colors.muted }}>
                {surveys ? JSON.stringify(surveys, null, 2).slice(0, 600) : 'Sem resumo NPS.'}
              </Text>
            </View>

            <SectionTitle>Estreias</SectionTitle>
            {premieres.length === 0 ? (
              <EmptyState title="Sem estreias" />
            ) : (
              premieres.map((e) => (
                <View key={e.id} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{e.title}</Text>
                  <Text style={{ color: colors.muted }}>
                    {e.slug} · {e.streamStatus || e.phase || '—'} ·{' '}
                    {e.isPublished !== false ? 'publicada' : 'rascunho'}
                  </Text>
                </View>
              ))
            )}

            <SectionTitle>Presentes Premium</SectionTitle>
            <View style={cardStyle}>
              <TextInput
                value={giftForm.email}
                onChangeText={(email) => setGiftForm((f) => ({ ...f, email }))}
                placeholder="email destinatário"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={inputStyle()}
              />
              <TextInput
                value={giftForm.days}
                onChangeText={(days) => setGiftForm((f) => ({ ...f, days }))}
                placeholder="Dias"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={inputStyle()}
              />
              <TextInput
                value={giftForm.note}
                onChangeText={(note) => setGiftForm((f) => ({ ...f, note }))}
                placeholder="Nota"
                placeholderTextColor={colors.muted}
                style={inputStyle()}
              />
              <PrimaryButton
                label="Oferecer Premium"
                onPress={() =>
                  run('gift-create', async () => {
                    await createGift({
                      recipientEmail: giftForm.email,
                      days: Number(giftForm.days) || 30,
                      message: giftForm.note,
                    });
                    setGiftForm({ email: '', days: '30', note: '' });
                  })
                }
              />
            </View>
            {gifts.map((g) => (
              <View key={g.id} style={cardStyle}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {g.recipientEmail || g.redeemedEmail || g.code || g.id}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {g.days || g.premiumDays || '—'} dias · {g.status || '—'}
                </Text>
                {g.status !== 'revoked' ? (
                  <View style={{ marginTop: 10 }}>
                    <PrimaryButton
                      label="Revogar"
                      variant="outline"
                      onPress={() => run(`gift-${g.id}`, () => revokeGift(g.id))}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {tab === 'promos' ? (
          <View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
              Códigos promocionais
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              <TextInput
                value={promoForm.code}
                onChangeText={(code) => setPromoForm((f) => ({ ...f, code }))}
                placeholder="CÓDIGO"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                style={inputStyle({ minWidth: 140, marginBottom: 0 })}
              />
              <TextInput
                value={promoForm.days}
                onChangeText={(days) => setPromoForm((f) => ({ ...f, days }))}
                placeholder="Dias"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={inputStyle({ width: 80, marginBottom: 0 })}
              />
              <TextInput
                value={promoForm.max}
                onChangeText={(max) => setPromoForm((f) => ({ ...f, max }))}
                placeholder="Máx."
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={inputStyle({ width: 90, marginBottom: 0 })}
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
              <EmptyState title="Sem códigos" />
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
            {streams.length === 0 ? (
              <EmptyState title="Ninguém a assistir agora" />
            ) : (
              streams.map((s) => (
                <View key={s.sessionId} style={cardStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{s.contentTitle}</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                    {s.email} · {s.deviceName || 'Dispositivo'} ({s.platform || '—'})
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
              style={inputStyle({ minHeight: 80, textAlignVertical: 'top' })}
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
