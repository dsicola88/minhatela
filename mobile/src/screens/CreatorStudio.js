import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, FieldLabel, cardSurface, fieldSurface } from '../components/ui';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { colors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import {
  registerCreator,
  fetchCreatorStudio,
  createCreatorContent,
  submitCreatorContent,
  createBunnyVideoSlot,
  fetchCreatorLedger,
  updateCreatorBank,
} from '../services/creatorStudio';
import { fetchMyPayouts, requestPayout } from '../services/payouts';
import FilmWizard from './studio/FilmWizard';

const NAV = [
  { id: 'home', label: 'Início' },
  { id: 'films', label: 'Os meus filmes' },
  { id: 'new', label: 'Novo filme' },
  { id: 'money', label: 'Receitas' },
];

const EMPTY_FILM = {
  title: '',
  synopsisShort: '',
  synopsisFull: '',
  posterUrl: '',
  genre: 'Cinema Angolano',
  ageRating: '12',
  releaseYear: String(new Date().getFullYear()),
  durationSeconds: '',
  monetization: 'avod',
  rentalPriceKz: '1500',
  bunnyVideoId: '',
  uploadDashboardUrl: '',
  rightsConfirmed: false,
};

const PAGE_SIZE = 8;

function encodingLabel(item) {
  const status = String(item.encodingStatus || '').toLowerCase();
  if (!item.bunnyVideoId && !item.hasVideo) return 'Sem ficheiro';
  if (['processing', 'encoding', 'queued'].includes(status)) return 'A processar';
  if (['error', 'failed'].includes(status)) return 'Processamento falhou';
  if (['ready', 'finished', 'encoded'].includes(status)) return 'Ficheiro pronto';
  return 'Ficheiro associado';
}

function maskIban(value) {
  const raw = String(value || '').replace(/\s/g, '');
  if (!raw) return '—';
  if (raw.length < 6) return '••••';
  return `•••• ${raw.slice(-4)}`;
}

function kz(value) {
  return `${Number(value || 0).toLocaleString('pt-AO')} Kz`;
}

export default function CreatorStudio({ onBack, onCompany }) {
  const { width } = useWindowDimensions();
  const { statusBarStyle } = useTheme();
  const isCompact = width < 960;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [data, setData] = useState(null);
  const [section, setSection] = useState('home');
  const [period, setPeriod] = useState('all');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rightsFor, setRightsFor] = useState({});
  const [registerForm, setRegisterForm] = useState({
    displayName: '',
    type: 'filmmaker',
    bio: '',
    bankIban: '',
    bankName: '',
    bankAccountName: '',
  });
  const [payouts, setPayouts] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [payoutAmount, setPayoutAmount] = useState('5000');
  const [bankForm, setBankForm] = useState({ bankIban: '', bankName: '', bankAccountName: '' });
  const [film, setFilm] = useState(EMPTY_FILM);
  const [wizardStep, setWizardStep] = useState(0);

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await fetchCreatorStudio(period);
      setData(result);
      if (result?.creator) {
        setBankForm({
          bankIban: result.creator.bankIban || '',
          bankName: result.creator.bankName || '',
          bankAccountName: result.creator.bankAccountName || '',
        });
      }
      if (result?.creator?.status === 'active') {
        const [payoutResult, ledgerResult] = await Promise.all([
          fetchMyPayouts(),
          fetchCreatorLedger(),
        ]);
        setPayouts(payoutResult);
        setLedger(ledgerResult?.entries || []);
      }
    } catch (err) {
      setError(err.message || 'Não foi possível abrir o estúdio');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const creator = data?.creator;
  const active = creator?.status === 'active';
  const nav = active ? NAV : NAV.filter((item) => item.id === 'home');
  const films = data?.contents || [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return films.filter((item) => {
      const statusOk = statusFilter === 'all' || item.workflowStatus === statusFilter;
      const textOk = !q || String(item.title || '').toLowerCase().includes(q);
      return statusOk && textOk;
    });
  }, [films, query, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  async function handleRegister() {
    if (!registerForm.displayName.trim()) {
      setError('Indique o nome artístico ou o nome da produtora.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await registerCreator(registerForm);
      setInfo('Candidatura enviada. Pode carregar filmes depois da decisão da equipa.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function filmPayload() {
    return {
      title: film.title.trim(),
      synopsisShort: film.synopsisShort.trim(),
      synopsisFull: film.synopsisFull.trim() || film.synopsisShort.trim(),
      posterUrl: film.posterUrl.trim(),
      genre: film.genre.trim(),
      ageRating: film.ageRating.trim() || '12',
      releaseYear: Number(film.releaseYear) || new Date().getFullYear(),
      durationSeconds: film.durationSeconds ? Number(film.durationSeconds) : 0,
      monetization: film.monetization,
      rentalPriceKz: film.monetization === 'tvod' ? Number(film.rentalPriceKz) : null,
      bunnyVideoId: film.bunnyVideoId || undefined,
      contentFormat: 'movie',
    };
  }

  function validateFilm() {
    if (!film.title.trim() || !film.synopsisShort.trim() || !film.posterUrl.trim()) {
      return 'Título, sinopse curta e cartaz são obrigatórios.';
    }
    if (film.monetization === 'tvod' && !(Number(film.rentalPriceKz) > 0)) {
      return 'Indique um preço de aluguer em Kz.';
    }
    return '';
  }

  async function handleSaveDraft() {
    const problem = validateFilm();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createCreatorContent(filmPayload());
      setInfo('Rascunho guardado. Ainda não está na mesa da equipa.');
      setFilm(EMPTY_FILM);
      setWizardStep(0);
      setSection('films');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitNew() {
    const problem = validateFilm();
    if (problem) {
      setError(problem);
      return;
    }
    if (!film.bunnyVideoId || !film.rightsConfirmed) {
      setError('Associe o vídeo e confirme os direitos antes de enviar.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await createCreatorContent(filmPayload());
      await submitCreatorContent(created.content.id, { rightsConfirmed: true });
      setInfo('Filme enviado. A equipa decide se entra no catálogo.');
      setFilm(EMPTY_FILM);
      setWizardStep(0);
      setSection('films');
      await load();
    } catch (err) {
      setError(err.message);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitExisting(id) {
    if (!rightsFor[id]) {
      setError('Confirme os direitos deste filme antes de o enviar outra vez.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submitCreatorContent(id, { rightsConfirmed: true });
      setInfo('Filme enviado para análise.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateBunnySlot() {
    if (!film.title.trim()) {
      setError('Indique o título antes de criar a ficha de vídeo.');
      return;
    }
    if (film.bunnyVideoId && film.uploadDashboardUrl) {
      Linking.openURL(film.uploadDashboardUrl).catch(() => {});
      return;
    }
    setBusy(true);
    setError('');
    try {
      const slot = await createBunnyVideoSlot({ title: film.title.trim() });
      const url = slot.upload?.dashboardUrl || '';
      setFilm((current) => ({
        ...current,
        bunnyVideoId: slot.bunnyVideoId || '',
        uploadDashboardUrl: url,
      }));
      setInfo(slot.message || 'Ficha de vídeo criada.');
      if (url) Linking.openURL(url).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <LoadingState />
      </View>
    );
  }

  const analytics = data?.analytics;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style={statusBarStyle} />
      <View style={{ flex: 1, flexDirection: isCompact ? 'column' : 'row' }}>
        <View
          style={{
            width: isCompact ? '100%' : 240,
            backgroundColor: colors.surface,
            borderRightWidth: isCompact ? 0 : 1,
            borderBottomWidth: isCompact ? 1 : 0,
            borderColor: colors.border,
            paddingHorizontal: 20,
            paddingVertical: 24,
          }}
        >
          <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 }}>
            MINHATELA
          </Text>
          <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1, marginTop: 4 }}>ESTÚDIO</Text>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, marginBottom: 12 }}>
            {creator?.displayName || 'MinhaTela'}
          </Text>
          <View style={{ flexDirection: isCompact ? 'row' : 'column', flexWrap: 'wrap', gap: 10 }}>
            {nav.map((item) => (
              <Pressable key={item.id} onPress={() => setSection(item.id)}>
                <Text style={{ color: section === item.id ? colors.gold : colors.textSecondary, fontWeight: '700' }}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
            {onBack ? (
              <Pressable onPress={onBack} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="play-outline" size={16} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 13 }}>Ver catálogo</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: isCompact ? 16 : 32,
            width: '100%',
            maxWidth: 760,
            alignSelf: 'center',
            paddingBottom: 80,
          }}
        >
          {info ? <Text style={{ color: colors.gold, marginBottom: 12, lineHeight: 20 }}>{info}</Text> : null}
          {error ? <ErrorState message={error} onRetry={load} /> : null}
          {section === 'home' ? (
            <Home
              data={data}
              creator={creator}
              active={active}
              analytics={analytics}
              period={period}
              onPeriod={(value) => {
                setLoading(true);
                setPeriod(value);
              }}
              registerForm={registerForm}
              setRegisterForm={setRegisterForm}
              onRegister={handleRegister}
              busy={busy}
              onCompany={onCompany}
            />
          ) : null}
          {section === 'films' ? (
            <Films
              films={visible}
              total={filtered.length}
              query={query}
              setQuery={(value) => {
                setQuery(value);
                setPage(0);
              }}
              statusFilter={statusFilter}
              setStatusFilter={(value) => {
                setStatusFilter(value);
                setPage(0);
              }}
              page={page}
              pageCount={pageCount}
              setPage={setPage}
              rightsFor={rightsFor}
              setRightsFor={setRightsFor}
              onSubmit={handleSubmitExisting}
              busy={busy}
            />
          ) : null}
          {section === 'new' && active ? (
            <FilmWizard
              form={film}
              setForm={setFilm}
              step={wizardStep}
              setStep={setWizardStep}
              busy={busy}
              onCreateSlot={handleCreateBunnySlot}
              onSaveDraft={handleSaveDraft}
              onSubmit={handleSubmitNew}
            />
          ) : null}
          {section === 'money' && active ? (
            <Finance
              analytics={analytics}
              payouts={payouts}
              ledger={ledger}
              iban={creator?.bankIban}
              bankForm={bankForm}
              setBankForm={setBankForm}
              amount={payoutAmount}
              setAmount={setPayoutAmount}
              busy={busy}
              onSaveBank={async () => {
                setBusy(true);
                setError('');
                try {
                  await updateCreatorBank(bankForm);
                  setInfo('IBAN guardado. O levantamento continua a ser tratado pela equipa, não é transferência automática.');
                  await load();
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
              onRequest={async () => {
                setBusy(true);
                setError('');
                try {
                  await requestPayout({ amountKz: Number(payoutAmount) });
                  setInfo('Pedido registado. A equipa financeira ainda tem de o processar.');
                  setPayouts(await fetchMyPayouts());
                  await load();
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function Home({ data, creator, active, analytics, period, onPeriod, registerForm, setRegisterForm, onRegister, busy, onCompany }) {
  return (
    <View>
      {data?.guide ? (
        <View style={cardSurface()}>
          <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800' }}>
            PASSO {data.guide.step} DE {data.guide.of}
          </Text>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, marginTop: 6 }}>{data.guide.title}</Text>
          <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>{data.guide.body}</Text>
        </View>
      ) : null}
      {!creator ? (
        <Application form={registerForm} setForm={setRegisterForm} busy={busy} onSubmit={onRegister} />
      ) : (
        <View style={cardSurface()}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{creator.displayName}</Text>
          <Text style={{ color: colors.gold, marginTop: 4 }}>{creator.statusLabel} · {creator.typeLabel}</Text>
          {!active ? (
            <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 20 }}>
              Enquanto a candidatura não for aceite, o estúdio não aceita filmes. A decisão chega nas notificações.
            </Text>
          ) : null}
          {onCompany && active ? (
            <Pressable onPress={onCompany} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.gold, fontWeight: '700' }}>Portal da produtora</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      {(data?.tasks || []).map((task) => (
        <View key={task.id} style={cardSurface()}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{task.title}</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>{task.detail}</Text>
        </View>
      ))}
      {active && analytics ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            {[['7d', '7 dias'], ['30d', '30 dias'], ['all', 'Tudo']].map(([id, label]) => (
              <Pressable key={id} onPress={() => onPeriod(id)}>
                <Text style={{ color: period === id ? colors.gold : colors.muted, fontWeight: '700' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: colors.muted, marginBottom: 10, lineHeight: 18 }}>
            Os números de filmes são o estado actual. Inícios, espectadores e receita registada respeitam o período.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Metric label="Publicados" value={analytics.content?.published} />
            <Metric label="Rascunhos" value={analytics.content?.drafts} />
            <Metric label="Em análise" value={(analytics.content?.submitted || 0) + (analytics.content?.underReview || 0)} />
            <Metric label="Recusados" value={analytics.content?.rejected} />
            <Metric label="A processar" value={analytics.content?.processing} />
            <Metric label="Inícios de reprodução" value={analytics.views} />
            <Metric label="Visualizações válidas" value={analytics.validViews} />
            <Metric label="Espectadores" value={analytics.uniqueViewers} />
            <Metric label="Na lista" value={analytics.subscribers} />
            <Metric label="Receita registada" value={kz(analytics.revenueKz)} />
            <Metric label="Saldo disponível" value={kz(analytics.finance?.availableKz)} />
            <Metric label="Levantamentos em curso" value={analytics.payouts?.pending} />
          </View>
          <Text style={{ color: colors.muted, marginTop: 12, lineHeight: 18 }}>
            Espectador é uma conta com início de reprodução. Visualização válida é o crédito aos 92%, uma vez por pessoa, filme e dia.
            {analytics.completion?.rate != null ? ` Conclusão dos progressos gravados: ${analytics.completion.rate}%.` : ''}
          </Text>
          {(analytics.unavailable || []).map((item) => (
            <Text key={item.id} style={{ color: colors.muted, marginTop: 6, lineHeight: 18 }}>
              {item.label}: indisponível. {item.reason}
            </Text>
          ))}
          {(analytics.titles || []).length ? (
            <View style={[cardSurface(), { marginTop: 16 }]}>
              <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 8 }}>Por filme</Text>
              {analytics.titles.map((item) => (
                <Text key={item.id} style={{ color: colors.textSecondary, marginTop: 6 }}>
                  {item.title}: {item.starts} inícios · {item.validViews} válidas · {kz(item.earningsKz)}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Application({ form, setForm, busy, onSubmit }) {
  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <View style={cardSurface()}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 12 }}>Pedir o estúdio</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        {[
          ['filmmaker', 'Cineasta independente'],
          ['creator', 'Criador'],
          ['producer', 'Produtor'],
          ['production_company', 'Produtora'],
        ].map(([id, label]) => (
          <Pressable key={id} onPress={() => patch('type', id)}>
            <Text style={{ color: form.type === id ? colors.gold : colors.textSecondary, fontWeight: '700' }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <FieldLabel>Nome artístico ou produtora</FieldLabel>
      <TextInput value={form.displayName} onChangeText={(v) => patch('displayName', v)} style={fieldSurface()} placeholderTextColor={colors.muted} />
      <FieldLabel>Biografia</FieldLabel>
      <TextInput value={form.bio} onChangeText={(v) => patch('bio', v)} style={[fieldSurface(), { minHeight: 96 }]} multiline placeholderTextColor={colors.muted} />
      <Text style={{ color: colors.muted, marginBottom: 10 }}>O contacto da candidatura é o email da conta.</Text>
      <FieldLabel>IBAN</FieldLabel>
      <TextInput value={form.bankIban} onChangeText={(v) => patch('bankIban', v)} style={fieldSurface()} placeholder="AO06…" placeholderTextColor={colors.muted} />
      <FieldLabel>Banco</FieldLabel>
      <TextInput value={form.bankName} onChangeText={(v) => patch('bankName', v)} style={fieldSurface()} placeholderTextColor={colors.muted} />
      <FieldLabel>Titular</FieldLabel>
      <TextInput value={form.bankAccountName} onChangeText={(v) => patch('bankAccountName', v)} style={fieldSurface()} placeholderTextColor={colors.muted} />
      <PrimaryButton label="Submeter candidatura" variant="gold" loading={busy} onPress={onSubmit} />
    </View>
  );
}

function Films({ films, total, query, setQuery, statusFilter, setStatusFilter, page, pageCount, setPage, rightsFor, setRightsFor, onSubmit, busy }) {
  const statuses = [
    ['all', 'Todos'],
    ['draft', 'Rascunho'],
    ['submitted', 'Na equipa'],
    ['under_review', 'Em revisão'],
    ['published', 'No catálogo'],
    ['rejected', 'Recusado'],
  ];
  return (
    <View>
      <TextInput value={query} onChangeText={setQuery} placeholder="Procurar título" placeholderTextColor={colors.muted} style={fieldSurface()} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        {statuses.map(([id, label]) => (
          <Pressable key={id} onPress={() => setStatusFilter(id)}>
            <Text style={{ color: statusFilter === id ? colors.gold : colors.muted, fontWeight: '700' }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {total === 0 ? (
        <EmptyState title="Nenhum filme neste filtro" subtitle="Os rascunhos e os envios aparecem aqui." />
      ) : (
        films.map((item) => (
          <View key={item.id} style={[cardSurface(), { flexDirection: 'row', gap: 12 }]}>
            {item.posterUrl ? (
              <Image source={{ uri: item.posterUrl }} style={{ width: 72, height: 104, backgroundColor: colors.surfaceSecondary }} />
            ) : (
              <View style={{ width: 72, height: 104, backgroundColor: colors.surfaceSecondary }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{item.title}</Text>
              <Text style={{ color: colors.gold, marginTop: 4 }}>{item.workflowLabel} · {item.monetizationLabel}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{encodingLabel(item)}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>
                Actualizado {item.updatedAt ? String(item.updatedAt).slice(0, 10) : '—'}
              </Text>
              {item.rejectionReason ? <Text style={{ color: colors.red, marginTop: 6 }}>{item.rejectionReason}</Text> : null}
              {item.workflowStatus === 'draft' || item.workflowStatus === 'rejected' ? (
                <View style={{ marginTop: 10 }}>
                  <Pressable onPress={() => setRightsFor((current) => ({ ...current, [item.id]: !current[item.id] }))}>
                    <Text style={{ color: rightsFor[item.id] ? colors.gold : colors.textSecondary }}>
                      {rightsFor[item.id] ? 'Direitos confirmados' : 'Confirmar direitos para enviar'}
                    </Text>
                  </Pressable>
                  <PrimaryButton label="Enviar à equipa" variant="gold" loading={busy} onPress={() => onSubmit(item.id)} style={{ marginTop: 8 }} />
                </View>
              ) : null}
            </View>
          </View>
        ))
      )}
      {pageCount > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <PrimaryButton label="Anterior" variant="outline" disabled={page === 0} onPress={() => setPage((n) => n - 1)} />
          <Text style={{ color: colors.muted, alignSelf: 'center' }}>{page + 1} / {pageCount}</Text>
          <PrimaryButton label="Seguinte" variant="outline" disabled={page + 1 >= pageCount} onPress={() => setPage((n) => n + 1)} />
        </View>
      ) : null}
    </View>
  );
}

function Finance({ analytics, payouts, ledger, iban, bankForm, setBankForm, amount, setAmount, busy, onSaveBank, onRequest }) {
  const rules = analytics?.rules;
  return (
    <View>
      <View style={cardSurface()}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Livro do estúdio</Text>
        <Line label="Receita registada" value={kz(analytics?.revenueKz)} />
        <Line label="Visualizações válidas" value={kz(analytics?.earningsBySource?.view)} />
        <Line label="Parte dos anúncios" value={kz(analytics?.earningsBySource?.ad_share)} />
        <Line label="Reservado ou pago" value={kz(analytics?.finance?.reservedOrPaidKz)} />
        <Line label="Saldo disponível" value={kz(payouts?.balance?.availableKz ?? analytics?.finance?.availableKz)} />
        <Line label="Pedidos em curso" value={String(analytics?.payouts?.pending || 0)} />
        <Line label="Pagos pela equipa" value={String(analytics?.payouts?.paid || 0)} />
        <Line label="Recusados" value={String(analytics?.payouts?.rejected || 0)} />
        <Text style={{ color: colors.muted, marginTop: 10, lineHeight: 18 }}>
          {rules?.qualifiedView} Cada visualização válida vale {rules?.viewKz ?? '—'} Kz. A parte dos anúncios é {rules?.adSharePercent ?? '—'}% do valor cobrado. Premium e aluguer controlam o acesso e não creditam este livro.
        </Text>
      </View>
      <View style={cardSurface()}>
        <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 8 }}>Conta para levantamento</Text>
        <Text style={{ color: colors.muted, marginBottom: 8, lineHeight: 18 }}>
          IBAN actual {maskIban(iban)}. Sem IBAN o pedido de levantamento é recusado.
        </Text>
        <FieldLabel>IBAN</FieldLabel>
        <TextInput value={bankForm?.bankIban} onChangeText={(v) => setBankForm((c) => ({ ...c, bankIban: v }))} style={fieldSurface()} placeholder="AO06…" placeholderTextColor={colors.muted} />
        <FieldLabel>Banco</FieldLabel>
        <TextInput value={bankForm?.bankName} onChangeText={(v) => setBankForm((c) => ({ ...c, bankName: v }))} style={fieldSurface()} placeholderTextColor={colors.muted} />
        <FieldLabel>Titular</FieldLabel>
        <TextInput value={bankForm?.bankAccountName} onChangeText={(v) => setBankForm((c) => ({ ...c, bankAccountName: v }))} style={fieldSurface()} placeholderTextColor={colors.muted} />
        <PrimaryButton label="Guardar IBAN" variant="outline" loading={busy} onPress={onSaveBank} />
      </View>
      <View style={cardSurface()}>
        <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 8 }}>Pedir levantamento</Text>
        <Text style={{ color: colors.muted, marginBottom: 8, lineHeight: 18 }}>
          Mínimo {kz(rules?.minPayoutKz || 5000)}. IBAN {maskIban(iban)}. O pedido fica pendente até a equipa financeira o tratar — não dispara transferência.
        </Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={fieldSurface()} placeholderTextColor={colors.muted} />
        <PrimaryButton label="Registar pedido" variant="gold" loading={busy} onPress={onRequest} />
        {(payouts?.payouts || []).map((item) => (
          <Text key={item.id} style={{ color: colors.textSecondary, marginTop: 10 }}>
            {kz(item.amountKz)} · {item.status} · {String(item.id).slice(0, 8)}
          </Text>
        ))}
      </View>
      <View style={cardSurface()}>
        <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 8 }}>Movimentos</Text>
        <Text style={{ color: colors.muted, marginBottom: 8, lineHeight: 18 }}>
          Cada linha é um crédito ou uma reversão registada. A declaração de direitos não prova a propriedade do filme.
        </Text>
        {(ledger || []).length === 0 ? (
          <Text style={{ color: colors.muted }}>Ainda sem movimentos.</Text>
        ) : (
          ledger.map((item) => (
            <Text key={item.id} style={{ color: colors.textSecondary, marginTop: 8 }}>
              {item.source === 'reversal' ? '−' : '+'}
              {kz(item.amountKz)} · {item.source}
              {item.contentTitle ? ` · ${item.contentTitle}` : ''}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

function Metric({ label, value }) {
  return (
    <View style={cardSurface({ minWidth: 140, flexGrow: 1, borderRadius: 6, padding: 12, marginBottom: 0 })}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 6 }}>{value ?? '—'}</Text>
    </View>
  );
}

function Line({ label, value }) {
  return (
    <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
      {label}: <Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text>
    </Text>
  );
}

