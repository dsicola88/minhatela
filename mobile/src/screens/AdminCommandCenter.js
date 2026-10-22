import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingState, EmptyState } from '../components/StateViews';
import { colors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../context/AppConfigContext';
import {
  TAB_META,
  navGroupsForUser,
  StatusBadge,
  PageHeader,
  cardStyle,
  inputStyle,
  SectionTitle,
  KpiCard,
  QueueChip,
  AuditRow,
  AdminSidebar,
  AdminMobileNav,
  AdminTopBar,
  AdminButton,
  ActionRow,
  AdminErrorBanner,
  toneForStatus,
} from './adminUi';
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
  fetchAppConfig,
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
  setExperimentActive,
  fetchUsers,
  fetchAdminPlans,
  fetchLeads,
  fetchUploads,
  fetchProofUploads,
  uploadAdminMedia,
  fetchAllAdCampaigns,
  fetchCatalog,
  fetchReports,
  fetchAcquisitions,
  fetchRights,
  fetchTenants,
  fetchConnections,
  createAcquisition,
  fetchApprovals,
  decideApproval,
  postCreatorLedger,
} from '../services/admin';
import { fetchPendingPayouts, reviewPayout } from '../services/payouts';
import {
  LandingPaymentsTab,
  CopySettingsTab,
  UsersTab,
  PlansTab,
  LeadsTab,
  UploadsTab,
  AdsTab,
  CatalogCmsTab,
  EditorialCollectionCard,
  ReportsTab,
  AcquisitionTab,
  RightsTab,
  TenantsTab,
  ConnectionsTab,
} from './AdminEnterpriseSections';

function getCardStyle() {
  return cardStyle();
}

export default function AdminCommandCenter({ onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { themeId, statusBarStyle } = useTheme();
  const { user } = useAuth();
  const { refresh: refreshAppConfig } = useAppConfig();
  const navGroups = useMemo(
    () => navGroupsForUser(user),
    [(user?.roles || []).join(','), user?.isAdmin]
  );
  const isCompact = width < 1080;
  const [tab, setTab] = useState('overview');
  const [approvals, setApprovals] = useState([]);
  const [refreshedAt, setRefreshedAt] = useState(null);
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
  const [catalogTitles, setCatalogTitles] = useState([]);
  const [reports, setReports] = useState([]);
  const [acquisitions, setAcquisitions] = useState([]);
  const [rights, setRights] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [connections, setConnections] = useState([]);
  const [acqTitle, setAcqTitle] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
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
  const [ledgerForm, setLedgerForm] = useState({
    creatorId: '',
    source: 'adjustment',
    amountKz: '',
    reason: '',
  });
  const [configDrafts, setConfigDrafts] = useState({});
  const [busy, setBusy] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [ticketNotes, setTicketNotes] = useState({});
  const [tabLoading, setTabLoading] = useState(false);
  const userQueryRef = useRef('');
  const catalogQueryRef = useRef('');
  userQueryRef.current = userQuery;
  catalogQueryRef.current = catalogQuery;

  const applyConfigDrafts = (cfg) => {
    const drafts = {};
    (cfg.settings || []).forEach((s) => {
      drafts[s.key] = JSON.stringify(s.value || {}, null, 2);
    });
    setConfigDrafts(drafts);
  };

  const loadCore = useCallback(async () => {
    const [cc, ap] = await Promise.all([
      fetchCommandCenter(),
      fetchApprovals().catch(() => ({ items: [] })),
    ]);
    setCenter(cc);
    setApprovals(ap.items || ap.requests || []);
    setRefreshedAt(new Date());
  }, []);

  const loadTab = useCallback(async (nextTab) => {
    if (nextTab === 'overview') return;
    setTabLoading(true);
    try {
    if (nextTab === 'payments') {
      const [pay, rk] = await Promise.all([
        fetchPendingPayments(),
        fetchPaymentRisk(0).catch(() => ({ transactions: [] })),
      ]);
      setPayments(pay.transactions || []);
      setRisk(rk.transactions || rk.items || []);
      return;
    }
    if (nextTab === 'users') {
      const us = await fetchUsers({ q: userQueryRef.current, limit: 40 }).catch(() => ({ users: [] }));
      setUsers(us.users || []);
      return;
    }
    if (nextTab === 'plans') {
      const pl = await fetchAdminPlans().catch(() => ({ plans: [] }));
      setAdminPlans(pl.plans || []);
      return;
    }
    if (nextTab === 'leads') {
      const ld = await fetchLeads({ limit: 50 }).catch(() => ({ leads: [] }));
      setLeads(ld.leads || []);
      return;
    }
    if (nextTab === 'support') {
      const [tk, art] = await Promise.all([
        fetchTickets(50).catch(() => ({ tickets: [] })),
        fetchHelpArticles().catch(() => ({ articles: [] })),
      ]);
      setTickets(tk.tickets || []);
      setArticles(art.articles || []);
      return;
    }
    if (nextTab === 'moderation') {
      const [cr, co, po, ca] = await Promise.all([
        fetchPendingCreators(),
        fetchPendingContent('submitted'),
        fetchPendingPayouts(),
        fetchPendingCampaigns(),
      ]);
      setCreators(cr.creators || []);
      setContents(co.contents || []);
      setPayouts(po.payouts || []);
      setCampaigns(ca.campaigns || []);
      return;
    }
    if (nextTab === 'ads') {
      const adsAll = await fetchAllAdCampaigns({}).catch(() => ({ campaigns: [] }));
      setAllAds(adsAll.campaigns || []);
      return;
    }
    if (nextTab === 'uploads') {
      const [up, pf] = await Promise.all([
        fetchUploads({ limit: 40 }).catch(() => ({ uploads: [] })),
        fetchProofUploads(40).catch(() => ({ proofs: [] })),
      ]);
      setUploads(up.uploads || []);
      setProofs(pf.proofs || []);
      return;
    }
    if (nextTab === 'cms') {
      const cat = await fetchCatalog({ q: catalogQueryRef.current, limit: 40 }).catch(() => ({ titles: [] }));
      setCatalogTitles(cat.titles || []);
      return;
    }
    if (nextTab === 'reports') {
      const reps = await fetchReports(40).catch(() => ({ reports: [] }));
      setReports(reps.reports || reps.items || []);
      return;
    }
    if (nextTab === 'editorial') {
      const ed = await fetchEditorial().catch(() => ({ collections: [] }));
      setCollections(ed.collections || []);
      return;
    }
    if (nextTab === 'flags') {
      const [fl, ex] = await Promise.all([
        fetchFeatureFlags().catch(() => ({ flags: [] })),
        fetchExperiments().catch(() => ({ experiments: [] })),
      ]);
      setFlags(fl.flags || []);
      setExperiments(ex.experiments || ex.items || []);
      return;
    }
    if (nextTab === 'landing' || nextTab === 'config') {
      const cfg = await fetchAppConfig().catch(() => ({ settings: [] }));
      setSettings(cfg.settings || []);
      applyConfigDrafts(cfg);
      return;
    }
    if (nextTab === 'media') {
      const [cd, enc] = await Promise.all([
        fetchCdnHealth().catch(() => null),
        fetchEncoding().catch(() => ({ items: [] })),
      ]);
      const items = cd?.items || cd?.checks || [];
      setCdn({
        items,
        healthy: Boolean(cd?.healthy) || items.some((i) => i.ok),
        latest: items[0] || null,
      });
      setEncoding(enc.items || enc.queue || []);
      return;
    }
    if (nextTab === 'catalog') {
      const [pk, sv, pm, gf] = await Promise.all([
        fetchAdminPacks().catch(() => ({ packs: [] })),
        fetchSurveySummary().catch(() => null),
        fetchAdminPremieres().catch(() => ({ events: [] })),
        fetchAdminGifts().catch(() => ({ gifts: [] })),
      ]);
      setPacks(pk.packs || pk.items || []);
      setSurveys(sv);
      setPremieres(pm.events || pm.premieres || []);
      setGifts(gf.gifts || []);
      return;
    }
    if (nextTab === 'promos') {
      const pr = await fetchPromos().catch(() => ({ promos: [] }));
      setPromos(pr.promos || []);
      return;
    }
    if (nextTab === 'live') {
      const live = await fetchLiveStreams();
      setStreams(live.streams || []);
      return;
    }
    if (nextTab === 'audit') {
      const au = await fetchAuditLog({ limit: 40 });
      setAudit(au.items || []);
      return;
    }
    if (nextTab === 'acquisition') {
      const d = await fetchAcquisitions({}).catch(() => ({ items: [] }));
      setAcquisitions(d.items || []);
      return;
    }
    if (nextTab === 'rights') {
      const d = await fetchRights({}).catch(() => ({ items: [] }));
      setRights(d.items || []);
      return;
    }
    if (nextTab === 'tenants') {
      const d = await fetchTenants().catch(() => ({ tenants: [] }));
      setTenants(d.tenants || []);
    }
    if (nextTab === 'connections') {
      const d = await fetchConnections().catch(() => ({ items: [] }));
      setConnections(d.items || []);
    }
    } finally {
      setTabLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError('');
      await loadCore();
      await loadTab(tab);
    } catch (err) {
      setError(err.message || 'Falha ao carregar Console Empresa');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadCore, loadTab, tab]);

  useEffect(() => {
    loadCore()
      .catch((err) => setError(err.message || 'Falha ao carregar Console Empresa'))
      .finally(() => setLoading(false));
  }, [loadCore]);

  useEffect(() => {
    const allowed = new Set(navGroups.flatMap((g) => g.items.map((i) => i.id)));
    if (!allowed.has(tab)) setTab('overview');
  }, [navGroups, tab]);

  useEffect(() => {
    setError('');
    loadTab(tab).catch((err) => setError(err.message || 'Falha ao carregar secção'));
  }, [tab, loadTab]);

  async function run(id, fn) {
    setBusy(id);
    try {
      await fn();
      await loadCore();
      await loadTab(tab);
      if (String(id).startsWith('cfg-')) await refreshAppConfig();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const roleLabel = (user?.roles || []).includes('super_admin')
    ? 'SuperAdmin'
    : (user?.roles || []).includes('admin')
      ? 'Admin'
      : user?.isAdmin
        ? 'Admin'
        : 'Staff';
  const meta = TAB_META[tab] || { label: 'Console', group: 'Operações' };

  if (loading) {
    return (
      <View key={themeId} style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingState />
      </View>
    );
  }

  const kpis = center?.kpis || {};
  const queues = center?.queues || {};

  return (
    <View key={themeId} style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, flexDirection: isCompact ? 'column' : 'row' }}>
      <StatusBar style={statusBarStyle} />
      {isCompact ? null : (
        <AdminSidebar
          tab={tab}
          onChange={setTab}
          attention={kpis.attentionRequired || 0}
          groups={navGroups}
        />
      )}
      <View style={{ flex: 1 }}>
      <AdminTopBar
        onBack={onBack}
        group={meta.group}
        title={meta.label}
        roleLabel={roleLabel}
        email={user?.email}
        refreshedAt={refreshedAt}
        attention={kpis.attentionRequired || 0}
        compact={isCompact}
      />

      {isCompact ? <AdminMobileNav tab={tab} onChange={setTab} groups={navGroups} /> : null}

      <ScrollView
        contentContainerStyle={{
          padding: isCompact ? 16 : 28,
          width: '100%',
          maxWidth: 1180,
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
        <AdminErrorBanner message={error} onRetry={load} onDismiss={() => setError('')} />
        {tabLoading ? (
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>A carregar secção…</Text>
        ) : null}

        {tab === 'overview' ? (
          <View>
            <PageHeader
              compact
              subtitle={
                roleLabel === 'SuperAdmin'
                  ? 'Marca, página de entrada, funcionalidades, mercados e operadores — tudo daqui, sem pedir a engenharia.'
                  : 'Filas, catálogo, pagamentos e atendimento deste mercado. A marca e as funcionalidades da plataforma ficam no SuperAdmin.'
              }
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
              <KpiCard label="UTILIZADORES" value={kpis.users ?? '—'} hint={`${kpis.premiumUsers || 0} Premium`} />
              <KpiCard
                label="RECEITA HOJE"
                value={center?.labels?.revenueToday || `${kpis.revenueTodayKz || 0} Kz`}
                hint={`${kpis.paymentsToday || 0} pagamentos`}
              />
              <KpiCard label="7 DIAS" value={center?.labels?.revenue7d || '—'} />
              <KpiCard
                label="PLAYS HOJE"
                value={kpis.playsToday ?? 0}
                hint={`${kpis.activeStreams ?? 0} streams agora`}
                tone={kpis.playsToday > 0 ? 'success' : 'info'}
              />
              <KpiCard
                label="GOSTOS / ESTRELAS"
                value={kpis.ratingsToday ?? 0}
                hint={kpis.ratingAvgToday ? `média ${kpis.ratingAvgToday} · hoje` : 'avaliações hoje'}
              />
              <KpiCard
                label="LISTA HOJE"
                value={kpis.favoritesToday ?? 0}
                hint="adicionados à Minha lista"
              />
              <KpiCard label="CATÁLOGO" value={kpis.publishedTitles ?? 0} hint={`${kpis.seriesCount || 0} séries`} />
              <KpiCard
                label="ATENÇÃO"
                value={kpis.attentionRequired ?? 0}
                hint="filas abertas"
                tone={kpis.attentionRequired > 0 ? 'warning' : 'success'}
              />
            </View>

            <SectionTitle>Filas operacionais</SectionTitle>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              <QueueChip label="Pagamentos" count={queues.payments || 0} onPress={() => setTab('payments')} />
              <QueueChip label="Atendimento" count={queues.tickets || 0} onPress={() => setTab('support')} />
              <QueueChip label="Candidaturas" count={queues.creators || 0} onPress={() => setTab('moderation')} />
              <QueueChip label="Filmes" count={queues.content || 0} onPress={() => setTab('moderation')} />
              <QueueChip label="Pagamentos a criadores" count={queues.payouts || 0} onPress={() => setTab('moderation')} />
              <QueueChip label="Campanhas" count={queues.campaigns || 0} onPress={() => setTab('moderation')} />
            </View>

            {approvals.length > 0 ? (
              <View>
                <SectionTitle>À espera do segundo SuperAdmin</SectionTitle>
                {approvals.map((req) => (
                  <View key={req.id} style={getCardStyle()}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>{req.action}</Text>
                        <Text style={{ color: colors.muted, marginTop: 4 }}>
                          {req.resourceType} · {req.reason || '—'}
                        </Text>
                      </View>
                      <StatusBadge tone="warning">{req.status || 'pending'}</StatusBadge>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                      <AdminButton
                        label="Aprovar"
                        onPress={() =>
                          run(`fe-${req.id}`, () =>
                            decideApproval(req.id, { approve: true, reason: 'aprovação console' })
                          )
                        }
                      />
                      <AdminButton
                        label="Rejeitar"
                        variant="outline"
                        onPress={() =>
                          run(`fe-r-${req.id}`, () =>
                            decideApproval(req.id, { approve: false, reason: 'rejeição console' })
                          )
                        }
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <SectionTitle>Auditoria recente</SectionTitle>
            {(center?.recentAudit || []).length === 0 ? (
              <EmptyState title="Sem eventos de auditoria" />
            ) : (
              center.recentAudit.map((item) => <AuditRow key={item.id} item={item} />)
            )}
          </View>
        ) : null}

        {tab === 'landing' ? (
          <LandingPaymentsTab settings={settings} run={run} busy={busy} />
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
            canManageAdmins={(user?.roles || []).includes('super_admin')}
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

        {tab === 'cms' ? (
          <CatalogCmsTab
            titles={catalogTitles}
            catalogQuery={catalogQuery}
            setCatalogQuery={setCatalogQuery}
            onSearch={() =>
              run('cms-search', async () => {
                const r = await fetchCatalog({ q: catalogQuery, limit: 40 });
                setCatalogTitles(r.titles || []);
              })
            }
            run={run}
          />
        ) : null}

        {tab === 'reports' ? <ReportsTab reports={reports} run={run} /> : null}

        {tab === 'payments' ? (
          <View>
            <PageHeader
              compact
              subtitle="Confirme transferências IBAN e referências Multicaixa. Quando aprova, o Premium ou o aluguer libertam-se na hora."
            />
            {payments.length === 0 ? (
              <EmptyState title="Fila limpa" subtitle="Nenhum comprovativo à espera." />
            ) : (
              payments.map((tx) => (
                <View key={tx.id} style={getCardStyle()}>
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
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <StatusBadge tone="warning">
                      {tx.statusLabel ||
                        ({ pending: 'Pendente', paid: 'Pago', rejected: 'Recusado' }[tx.status] ||
                          tx.status ||
                          'Pendente')}
                    </StatusBadge>
                    {tx.riskScore != null ? (
                      <StatusBadge tone={tx.riskScore >= 70 ? 'danger' : 'warning'}>
                        Risco {tx.riskScore}
                      </StatusBadge>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                    {tx.proofUrl ? (
                      <AdminButton
                        label="Comprovativo"
                        variant="outline"
                        onPress={() => Linking.openURL(resolveProofUrl(tx.proofUrl))}
                      />
                    ) : null}
                    <AdminButton
                      label={busy === tx.id ? '…' : 'Aprovar'}
                      onPress={() => run(tx.id, () => reviewPayment(tx.id, { status: 'pago' }))}
                      disabled={busy === tx.id}
                    />
                    <AdminButton
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
                <View key={`risk-${tx.id}`} style={getCardStyle()}>
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
            <PageHeader
              compact
              subtitle="Tickets de suporte e artigos do Centro de Ajuda."
            />

            <SectionTitle>Tickets abertos</SectionTitle>
            {tickets.length === 0 ? (
              <EmptyState title="Sem tickets em aberto" />
            ) : (
              tickets.map((t) => (
                <View key={t.id} style={getCardStyle()}>
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
                    <AdminButton
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
                    <AdminButton
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
                    <AdminButton
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
            <View style={getCardStyle()}>
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
              <AdminButton
                label={busy === 'article-create' ? '…' : 'Publicar artigo'}
                onPress={() =>
                  run('article-create', async () => {
                    if (!articleForm.slug.trim() || !articleForm.title.trim()) {
                      throw new Error('Slug e título do artigo são obrigatórios');
                    }
                    await upsertHelpArticle(articleForm);
                    setArticleForm({ slug: '', title: '', category: 'geral', bodyMd: '' });
                  })
                }
              />
            </View>
            {articles.map((a) => (
              <View key={a.id} style={getCardStyle()}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{a.title}</Text>
                <Text style={{ color: colors.muted }}>
                  {a.slug} · {a.category} · {a.isPublished ? 'publicado' : 'rascunho'}
                </Text>
                <View style={{ marginTop: 10 }}>
                  <AdminButton
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
            <PageHeader
              compact
              subtitle="Candidaturas ao estúdio, filmes para o catálogo, levantamentos e anúncios. O que publica aqui é o que o público vê na app."
            />
            <SectionTitle>Candidaturas ao estúdio</SectionTitle>
            {creators.length === 0 ? (
              <EmptyState title="Nenhuma candidatura à espera" subtitle="Quando um cineasta pede o estúdio, aparece aqui." />
            ) : (
              creators.map((c) => (
                <View key={c.id} style={getCardStyle()}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{c.displayName}</Text>
                  <Text style={{ color: colors.muted }}>
                    {c.email} · {c.typeLabel || c.type}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <AdminButton
                      label="Aceitar no estúdio"
                      onPress={() => run(c.id, () => reviewCreator(c.id, 'active'))}
                    />
                    <AdminButton
                      label="Recusar"
                      variant="outline"
                      onPress={() =>
                        setRejectTarget({ type: 'creator', id: c.id, title: c.displayName })
                      }
                    />
                  </View>
                </View>
              ))
            )}

            <SectionTitle>Filmes para o catálogo</SectionTitle>
            {contents.length === 0 ? (
              <EmptyState
                title="Nenhum filme na mesa"
                subtitle="O cineasta envia no Estúdio; aqui decide se entra na app."
              />
            ) : (
              contents.map((item) => (
                <View key={item.id} style={getCardStyle()}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>
                    {item.creatorDisplayName || 'Cineasta'}
                    {item.creatorEmail ? ` · ${item.creatorEmail}` : ''}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>
                    {item.workflowLabel || item.workflowStatus} · {item.monetizationLabel || item.monetization}
                    {item.hasVideo ? ' · vídeo na ficha' : ' · sem ficheiro'}
                  </Text>
                  {item.synopsisShort ? (
                    <Text style={{ color: colors.textSecondary, marginTop: 8, lineHeight: 20 }}>
                      {item.synopsisShort}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                    <AdminButton
                      label="Pôr na app"
                      onPress={() =>
                        run(item.id, () => moderateContent(item.id, { action: 'publish' }))
                      }
                    />
                    <AdminButton
                      label="Recusar"
                      variant="outline"
                      onPress={() =>
                        setRejectTarget({ type: 'content', id: item.id, title: item.title })
                      }
                    />
                  </View>
                </View>
              ))
            )}

            <SectionTitle>Levantamentos dos cineastas</SectionTitle>
            {payouts.length === 0 ? (
              <EmptyState title="Nenhum levantamento à espera" />
            ) : (
              payouts.map((p) => (
                <View key={p.id} style={getCardStyle()}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {p.displayName || p.creatorName} · {p.amountKz?.toLocaleString('pt-AO')} Kz
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>
                    {p.email || ''}
                    {p.bankIban ? ` · IBAN …${String(p.bankIban).slice(-4)}` : ' · sem IBAN'}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>
                    Marcar pago só depois da transferência fora da app. Isto não envia dinheiro.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <AdminButton
                      label="Marcar pago"
                      onPress={() => run(p.id, () => reviewPayout(p.id, { status: 'paid' }))}
                    />
                    <AdminButton
                      label="Rejeitar"
                      variant="outline"
                      onPress={() =>
                        setRejectTarget({ type: 'payout', id: p.id, title: p.displayName || p.creatorName })
                      }
                    />
                  </View>
                </View>
              ))
            )}

            {(user?.roles || []).includes('super_admin') ? (
            <>
            <SectionTitle>Livro do cineasta</SectionTitle>
            <View style={getCardStyle()}>
              <Text style={{ color: colors.muted, marginBottom: 10, lineHeight: 20 }}>
                Ajuste aumenta o saldo. Reversão reduz. Não é pagamento bancário. Use o identificador do cineasta.
              </Text>
              <TextInput
                value={ledgerForm.creatorId}
                onChangeText={(creatorId) => setLedgerForm((f) => ({ ...f, creatorId }))}
                placeholder="identificador do cineasta"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={inputStyle()}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                {[['adjustment', 'Ajuste'], ['reversal', 'Reversão']].map(([id, label]) => (
                  <AdminButton
                    key={id}
                    label={label}
                    variant={ledgerForm.source === id ? undefined : 'outline'}
                    onPress={() => setLedgerForm((f) => ({ ...f, source: id }))}
                  />
                ))}
              </View>
              <TextInput
                value={ledgerForm.amountKz}
                onChangeText={(amountKz) => setLedgerForm((f) => ({ ...f, amountKz }))}
                placeholder="valor em Kz"
                keyboardType="numeric"
                placeholderTextColor={colors.muted}
                style={inputStyle()}
              />
              <TextInput
                value={ledgerForm.reason}
                onChangeText={(reason) => setLedgerForm((f) => ({ ...f, reason }))}
                placeholder="motivo (obrigatório para a auditoria)"
                placeholderTextColor={colors.muted}
                style={inputStyle()}
              />
              <AdminButton
                label="Lançar no livro"
                onPress={() =>
                  run('ledger', async () => {
                    if (!ledgerForm.creatorId || !ledgerForm.amountKz || !ledgerForm.reason.trim()) {
                      throw new Error('Identificador, valor e motivo são obrigatórios.');
                    }
                    await postCreatorLedger({
                      creatorId: ledgerForm.creatorId.trim(),
                      source: ledgerForm.source,
                      amountKz: Number(ledgerForm.amountKz),
                      reason: ledgerForm.reason.trim(),
                    });
                    setLedgerForm({ creatorId: '', source: 'adjustment', amountKz: '', reason: '' });
                  })
                }
              />
            </View>
            </>
            ) : null}

            <SectionTitle>Anúncios à espera</SectionTitle>
            {campaigns.length === 0 ? (
              <EmptyState title="Nenhum anúncio à espera" />
            ) : (
              campaigns.map((c) => (
                <View key={c.id} style={getCardStyle()}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{c.name}</Text>
                  <Text style={{ color: colors.muted }}>
                    {c.companyName} · {c.placementLabel || 'Antes do filme'} ·{' '}
                    {c.budgetKz?.toLocaleString('pt-AO')} Kz
                  </Text>
                  <Text style={{ color: colors.gold, marginTop: 6 }}>
                    {c.lifecycle?.label || (c.funded ? 'Em análise' : 'Pagar orçamento')}
                  </Text>
                  {c.lifecycle?.hint ? (
                    <Text style={{ color: colors.muted, marginTop: 4 }}>{c.lifecycle.hint}</Text>
                  ) : null}
                  {!c.funded ? (
                    <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 18 }}>
                      Confirme o pagamento na fila de comprovativos antes de pôr no ar.
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                    {c.funded ? (
                      <AdminButton
                        label="Pôr no ar"
                        onPress={() => run(c.id, () => reviewCampaign(c.id, 'active'))}
                      />
                    ) : (
                      <AdminButton
                        label="Pagamento em falta"
                        variant="outline"
                        onPress={() => {}}
                        disabled
                      />
                    )}
                    <AdminButton
                      label="Recusar"
                      variant="outline"
                      onPress={() =>
                        setRejectTarget({ type: 'campaign', id: c.id, title: c.name })
                      }
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'editorial' ? (
          <View>
            <PageHeader
              compact
              subtitle="Títulos das filas da Home. Editar e publicar altera o catálogo do consumidor."
            />
            <View style={getCardStyle()}>
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
              <AdminButton
                label="Criar colecção"
                onPress={() =>
                  run('ed-create', async () => {
                    if (!editorialForm.slug.trim() || !editorialForm.title.trim()) {
                      throw new Error('Slug e título são obrigatórios');
                    }
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
                <EditorialCollectionCard key={c.id} collection={c} run={run} />
              ))
            )}
          </View>
        ) : null}

        {tab === 'flags' ? (
          <View>
            <PageHeader
              compact
              subtitle="Ligue ou desligue partes da app (checkout, extras, experiências) sem esperar por um lançamento."
            />
            {flags.length === 0 ? (
              <EmptyState title="Nenhuma funcionalidade configurada" />
            ) : (
              flags.map((f) => (
                <View
                  key={f.key}
                  style={{
                    ...getCardStyle(),
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      {f.description || f.key}
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

            <SectionTitle>Testes de ecrã (A/B)</SectionTitle>
            {experiments.length === 0 ? (
              <EmptyState title="Nenhum teste a correr" />
            ) : (
              experiments.map((e, idx) => (
                <View
                  key={e.key || e.id || idx}
                  style={{
                    ...getCardStyle(),
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      {e.name || e.key || e.id}
                    </Text>
                    <Text style={{ color: colors.muted, marginTop: 4 }}>
                      {e.description ||
                        (Array.isArray(e.variants) ? e.variants.join(' · ') : 'Duas versões do ecrã')}
                      {e.assignments ? ` · ${e.assignments} pessoas` : ''}
                    </Text>
                  </View>
                  <Switch
                    value={Boolean(e.isActive)}
                    onValueChange={(isActive) =>
                      run(`exp-${e.id}`, async () => {
                        await setExperimentActive(e.id, isActive);
                        const d = await fetchExperiments();
                        setExperiments(d.experiments || d.items || []);
                      })
                    }
                    trackColor={{ false: colors.border, true: colors.red }}
                    thumbColor={colors.text}
                  />
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'config' ? (
          <CopySettingsTab
            settings={settings}
            configDrafts={configDrafts}
            setConfigDrafts={setConfigDrafts}
            run={run}
            busy={busy}
          />
        ) : null}

        {tab === 'media' ? (
          <View>
            <PageHeader
              compact
              subtitle="A imagem chega bem aos telemóveis? Verifique a rede de vídeo e o que ainda está a processar."
              extra={
                <AdminButton
                  label={busy === 'cdn-probe' ? 'A verificar…' : 'Verificar rede'}
                  onPress={() =>
                    run('cdn-probe', async () => {
                      const r = await probeCdn();
                      const items = r.checks || r.items || [];
                      setCdn({
                        items,
                        healthy: Boolean(r.healthy) || items.some((i) => i.ok),
                        latest: items[0] || null,
                      });
                    })
                  }
                />
              }
            />
            <View style={getCardStyle()}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Rede de vídeo</Text>
                <StatusBadge tone={cdn?.healthy ? 'success' : cdn?.latest ? 'warning' : 'info'}>
                  {cdn?.healthy ? 'saudável' : cdn?.latest ? 'atenção' : 'sem probe'}
                </StatusBadge>
              </View>
              {(cdn?.items || []).slice(0, 6).map((item) => (
                <View
                  key={item.id || item.probeType}
                  style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
                >
                  <Text style={{ color: colors.textSecondary, flex: 1 }}>
                    {item.probeType || 'probe'} · {item.latencyMs ?? '—'} ms · HTTP {item.httpStatus ?? '—'}
                  </Text>
                  <StatusBadge tone={item.ok ? 'success' : 'danger'}>{item.ok ? 'ok' : 'falha'}</StatusBadge>
                </View>
              ))}
              {cdn?.latest?.error ? (
                <Text style={{ color: colors.gold, marginTop: 8 }}>{String(cdn.latest.error)}</Text>
              ) : null}
            </View>
            <SectionTitle>A processar qualidade</SectionTitle>
            {encoding.length === 0 ? (
              <EmptyState title="Nada a processar" subtitle="Quando um título entra, aparece aqui até ficar pronto a ver." />
            ) : (
              encoding.slice(0, 30).map((item) => (
                <View key={item.id || item.contentId} style={getCardStyle()}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
                      {item.title || item.contentId || item.id}
                    </Text>
                    <StatusBadge tone={toneForStatus(item.status || item.encodingStatus)}>
                      {item.status || item.encodingStatus || '—'}
                    </StatusBadge>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'catalog' ? (
          <View>
            <PageHeader
              compact
              subtitle="Ofertas TVOD, inquéritos e janelas de live premiere."
            />
            <SectionTitle>Packs TVOD</SectionTitle>
            {packs.length === 0 ? (
              <EmptyState title="Sem packs" />
            ) : (
              packs.map((p) => (
                <View key={p.id || p.slug} style={getCardStyle()}>
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
            <View style={getCardStyle()}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Resumo</Text>
              <Text style={{ color: colors.muted, marginTop: 8 }}>
                {surveys?.responses ?? surveys?.total ?? 0} respostas · NPS {surveys?.npsScore ?? '—'} ·
                média {surveys?.avgNps ?? '—'} · promotores {surveys?.promoters ?? 0}
              </Text>
            </View>

            <SectionTitle>Estreias</SectionTitle>
            {premieres.length === 0 ? (
              <EmptyState title="Sem estreias" />
            ) : (
              premieres.map((e) => (
                <View key={e.id} style={getCardStyle()}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{e.title}</Text>
                  <Text style={{ color: colors.muted }}>
                    {e.slug} · {e.streamStatus || e.phase || '—'} ·{' '}
                    {e.isPublished !== false ? 'publicada' : 'rascunho'}
                  </Text>
                </View>
              ))
            )}

            <SectionTitle>Presentes Premium</SectionTitle>
            <View style={getCardStyle()}>
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
              <AdminButton
                label="Oferecer Premium"
                onPress={() =>
                  run('gift-create', async () => {
                    if (!giftForm.email.includes('@')) {
                      throw new Error('Indique o email do destinatário');
                    }
                    await createGift({
                      recipientEmail: giftForm.email.trim().toLowerCase(),
                      days: Number(giftForm.days) || 30,
                      message: giftForm.note,
                    });
                    setGiftForm({ email: '', days: '30', note: '' });
                  })
                }
              />
            </View>
            {gifts.map((g) => (
              <View key={g.id} style={getCardStyle()}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {g.recipientEmail || g.redeemedEmail || g.code || g.id}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {g.days || g.premiumDays || '—'} dias · {g.status || '—'}
                </Text>
                {g.status !== 'revoked' ? (
                  <View style={{ marginTop: 10 }}>
                    <AdminButton
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
            <PageHeader compact subtitle="Códigos de dias Premium. Activar ou desactivar sem apagar histórico." />
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
              <AdminButton
                label={busy === 'promo-create' ? '…' : 'Criar'}
                onPress={() =>
                  run('promo-create', async () => {
                    if (!promoForm.code.trim()) throw new Error('Código promocional obrigatório');
                    await createPromo({
                      code: promoForm.code.trim().toUpperCase(),
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
                <View key={p.id} style={getCardStyle()}>
                  <Text style={{ color: colors.text, fontWeight: '800', letterSpacing: 1 }}>
                    {p.code}
                  </Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                    {p.valueInt} dias · {p.redemptionCount}
                    {p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : ''} resgates ·{' '}
                    {p.isActive ? 'activo' : 'inactivo'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <AdminButton
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
            <PageHeader compact subtitle="Quem está a ver agora, em que dispositivo." />
            {streams.length === 0 ? (
              <EmptyState title="Ninguém a assistir agora" />
            ) : (
              streams.map((s) => (
                <View key={s.sessionId} style={getCardStyle()}>
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
            <PageHeader compact subtitle="Quem fez o quê, e quando. Útil para disputas e segurança." />
            {audit.length === 0 ? (
              <EmptyState title="Sem registos" />
            ) : (
              audit.map((item) => <AuditRow key={item.id} item={item} />)
            )}
          </View>
        ) : null}

        {tab === 'acquisition' ? (
          <View>
            <TextInput
              value={acqTitle}
              onChangeText={setAcqTitle}
              placeholder="Novo título a adquirir"
              placeholderTextColor={colors.muted}
              style={inputStyle()}
            />
            <AdminButton
              label="Registar prospecto"
              onPress={() =>
                run('acq-new', async () => {
                  if (!acqTitle.trim()) throw new Error('Título da aquisição é obrigatório');
                  await createAcquisition({ title: acqTitle.trim(), notes: 'prospecto console' });
                  setAcqTitle('');
                  const d = await fetchAcquisitions({});
                  setAcquisitions(d.items || []);
                })
              }
            />
            <AcquisitionTab items={acquisitions} run={run} />
          </View>
        ) : null}
        {tab === 'rights' ? <RightsTab items={rights} /> : null}
        {tab === 'tenants' ? <TenantsTab items={tenants} run={run} /> : null}
        {tab === 'connections' ? <ConnectionsTab items={connections} /> : null}
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
              Motivo da recusa
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder={
                rejectTarget?.type === 'campaign'
                  ? 'O anunciante vê este texto'
                  : rejectTarget?.type === 'payout'
                    ? 'O cineasta vê este texto'
                    : rejectTarget?.type === 'creator'
                      ? 'O candidato ao estúdio vê este texto'
                      : 'O cineasta e o cliente vêem este texto'
              }
              placeholderTextColor={colors.muted}
              style={inputStyle({ minHeight: 80, textAlignVertical: 'top' })}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AdminButton label="Cancelar" variant="outline" onPress={() => setRejectTarget(null)} />
              <AdminButton
                label="Confirmar"
                onPress={() => {
                  const target = rejectTarget;
                  const reason = rejectReason || 'Recusado';
                  setRejectTarget(null);
                  setRejectReason('');
                  if (target?.type === 'payment') {
                    run(target.id, () =>
                      reviewPayment(target.id, {
                        status: 'rejeitado',
                        adminNotes: reason,
                      })
                    );
                  }
                  if (target?.type === 'content') {
                    run(target.id, () =>
                      moderateContent(target.id, { action: 'reject', rejectionReason: reason })
                    );
                  }
                  if (target?.type === 'creator') {
                    run(target.id, () => reviewCreator(target.id, 'rejected', reason));
                  }
                  if (target?.type === 'campaign') {
                    run(target.id, () => reviewCampaign(target.id, 'rejected', reason));
                  }
                  if (target?.type === 'payout') {
                    run(target.id, () => reviewPayout(target.id, { status: 'rejected', notes: reason }));
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </View>
  );
}
