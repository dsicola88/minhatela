import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, FieldLabel } from '../components/ui';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { colors, layout } from '../theme/tokens';
import {
  registerAdvertiser,
  fetchAdPortal,
  createCampaign,
  pauseCampaign,
  fetchAdReports,
  resolveAdMediaUrl,
} from '../services/ads';

const STEPS = [
  { id: 1, title: 'Objectivo' },
  { id: 2, title: 'Empresa' },
  { id: 3, title: 'Vídeo' },
  { id: 4, title: 'Destino' },
  { id: 5, title: 'Onde passa' },
  { id: 6, title: 'Orçamento' },
  { id: 7, title: 'Rever' },
];

const emptyDraft = () => ({
  objective: 'brand',
  name: '',
  budgetKz: '50000',
  placement: 'pre_roll',
  startsAt: new Date().toISOString().slice(0, 10),
  endsAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  mediaUrl: '',
  clickUrl: '',
  ctaLabel: 'Saber mais',
  contentCategory: '',
  frequencyCapPerDay: '0',
});

export default function AdPortal({ onBack }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [data, setData] = useState(null);
  const [reports, setReports] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(emptyDraft);

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await fetchAdPortal();
      setData(result);
      if (result.advertiser) {
        const rep = await fetchAdReports().catch(() => null);
        setReports(rep);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = data?.stats || reports?.totals;
  const measurement = data?.measurement || reports?.measurement;

  const filtered = useMemo(() => {
    const list = data?.campaigns || [];
    return list.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (query && !String(c.name || '').toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [data, query, statusFilter]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <LoadingState />
      </View>
    );
  }

  const advertiser = data?.advertiser;

  function setField(key, value) {
    setDraft((s) => ({ ...s, [key]: value }));
  }

  async function submitWizard() {
    setBusy(true);
    setError('');
    try {
      const res = await createCampaign({
        name: draft.name,
        objective: draft.objective,
        budgetKz: Number(draft.budgetKz),
        placement: 'pre_roll',
        startsAt: new Date(`${draft.startsAt}T00:00:00`).toISOString(),
        endsAt: new Date(`${draft.endsAt}T23:59:59`).toISOString(),
        targeting: {
          territory: 'AO',
          contentCategory: draft.contentCategory || undefined,
          frequencyCapPerDay: Number(draft.frequencyCapPerDay) || 0,
        },
        creative: {
          title: draft.name,
          mediaUrl: draft.mediaUrl,
          clickUrl: draft.clickUrl,
          ctaLabel: draft.ctaLabel,
        },
      });
      setInfo(res.message || 'Enviada. A MinhaTela confirma antes de ir para o ar.');
      setWizard(false);
      setStep(1);
      setDraft(emptyDraft());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const rows = reports?.campaigns || filtered;
    const csv = [
      'campanha,estado,orcamento_kz,gasto_kz,saldo_kz,impressoes,inicios,conclusoes,cliques,ctr',
      ...rows.map((c) =>
        [
          `"${String(c.name || '').replace(/"/g, '""')}"`,
          c.status,
          c.budgetKz,
          c.spentKz,
          c.remainingKz ?? '',
          c.impressions ?? '',
          c.starts ?? '',
          c.completions ?? '',
          c.clicks ?? '',
          c.ctr ?? '',
        ].join(',')
      ),
    ].join('\n');
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      navigator.clipboard?.writeText?.(csv);
      setInfo('Relatório copiado. Cole num ficheiro .csv');
    } else {
      setInfo(csv.slice(0, 400));
    }
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
          paddingBottom: 80,
        }}
      >
        <Pressable
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={{ color: colors.textSecondary }}>Voltar</Text>
        </Pressable>

        <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }}>
          PUBLICIDADE
        </Text>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
          Gestão de anúncios
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 22, lineHeight: 22 }}>
          Empresa → campanha em passos → a MinhaTela confirma → passa antes dos filmes gratuitos.
          Só a visualização completa gasta o orçamento. Angola. Sem dados pessoais do público.
        </Text>

        {data?.guide && !wizard ? (
          <View
            style={{
              backgroundColor: '#111111',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              borderLeftWidth: 3,
              borderLeftColor: colors.gold,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800' }}>
              PASSO {data.guide.step} DE {data.guide.of}
            </Text>
            <Text style={{ color: colors.text, fontWeight: '700', marginTop: 6, fontSize: 16 }}>
              {data.guide.title}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>
              {data.guide.body}
            </Text>
          </View>
        ) : null}

        {info ? (
          <Text style={{ color: colors.gold, marginBottom: 16, lineHeight: 20 }}>{info}</Text>
        ) : null}
        {error ? <ErrorState message={error} onRetry={load} /> : null}

        {!advertiser ? (
          <View style={panelStyle}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              Identificar a empresa
            </Text>
            <FieldLabel>Empresa</FieldLabel>
            <TextInput
              value={companyName}
              onChangeText={setCompanyName}
              style={inputStyle}
              placeholder="Nome comercial"
              placeholderTextColor={colors.muted}
            />
            <FieldLabel>Email de contacto</FieldLabel>
            <TextInput
              value={contactEmail}
              onChangeText={setContactEmail}
              style={inputStyle}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="financeiro@empresa.ao"
              placeholderTextColor={colors.muted}
            />
            <PrimaryButton
              label="Abrir conta de publicidade"
              variant="gold"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                setError('');
                try {
                  await registerAdvertiser({ companyName, contactEmail });
                  setInfo('Conta aberta. Crie a primeira campanha.');
                  await load();
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        ) : wizard ? (
          <Wizard
            step={step}
            setStep={setStep}
            draft={draft}
            setField={setField}
            advertiser={advertiser}
            busy={busy}
            onCancel={() => {
              setWizard(false);
              setStep(1);
            }}
            onSubmit={submitWizard}
            measurement={measurement}
          />
        ) : (
          <>
            <View style={panelStyle}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>
                {advertiser.companyName}
              </Text>
              <Text style={{ color: colors.muted }}>{advertiser.contactEmail}</Text>
            </View>

            {stats ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                <MiniStat
                  label="Investido (Kz)"
                  value={Number(stats.budgetKz || 0).toLocaleString('pt-AO')}
                />
                <MiniStat
                  label="Gasto (Kz)"
                  value={Number(stats.spentKz || 0).toLocaleString('pt-AO')}
                />
                <MiniStat
                  label="Saldo (Kz)"
                  value={Number(stats.remainingKz || 0).toLocaleString('pt-AO')}
                  gold
                />
                <MiniStat label="Visto até ao fim" value={stats.completions || stats.billedViews || 0} />
                <MiniStat label="Cliques" value={stats.clicks || 0} />
                <MiniStat label="CTR %" value={stats.ctr || 0} />
              </View>
            ) : null}

            {measurement?.note ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 16, lineHeight: 18 }}>
                {measurement.note} Valor por visualização completa: {measurement.unitKz} Kz.
              </Text>
            ) : null}

            <PrimaryButton
              label="Nova campanha"
              variant="gold"
              onPress={() => {
                setDraft(emptyDraft());
                setStep(1);
                setWizard(true);
                setError('');
              }}
              style={{ marginBottom: 16 }}
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Pesquisar campanha"
                placeholderTextColor={colors.muted}
                style={{ ...inputStyle, flex: 1, minWidth: 180, marginBottom: 0 }}
              />
              {['', 'pending_review', 'active', 'paused', 'rejected', 'completed'].map((s) => (
                <Pressable
                  key={s || 'all'}
                  onPress={() => setStatusFilter(s)}
                  style={{
                    borderWidth: 1,
                    borderColor: statusFilter === s ? colors.gold : colors.border,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12 }}>
                    {s === ''
                      ? 'Todas'
                      : s === 'pending_review'
                        ? 'À espera'
                        : s === 'active'
                          ? 'No ar'
                          : s === 'paused'
                            ? 'Pausadas'
                            : s === 'rejected'
                              ? 'Recusadas'
                              : 'Esgotadas'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={exportCsv} style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.gold, fontWeight: '700' }}>Copiar relatório CSV</Text>
            </Pressable>

            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
              Campanhas
            </Text>
            {filtered.length === 0 ? (
              <EmptyState
                title="Ainda sem anúncios"
                subtitle="Crie em passos. A MinhaTela põe no ar; o público vê antes do filme gratuito."
              />
            ) : (
              filtered.map((item) => (
                <View key={item.id} style={panelStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: colors.gold, marginTop: 4 }}>
                    {item.statusLabel} · {item.placementLabel}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 6 }}>
                    {item.startsAt ? new Date(item.startsAt).toLocaleDateString('pt-AO') : '—'} →{' '}
                    {item.endsAt ? new Date(item.endsAt).toLocaleDateString('pt-AO') : '—'}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>
                    Orçamento {Number(item.budgetKz || 0).toLocaleString('pt-AO')} Kz · gasto{' '}
                    {Number(item.spentKz || 0).toLocaleString('pt-AO')} Kz · saldo{' '}
                    {Number(item.remainingKz || 0).toLocaleString('pt-AO')} Kz
                  </Text>
                  {item.rejectionReason ? (
                    <Text style={{ color: colors.red, marginTop: 6 }}>Motivo: {item.rejectionReason}</Text>
                  ) : null}
                  {item.creative?.mediaUrl ? (
                    <Text style={{ color: colors.muted, marginTop: 6 }} numberOfLines={1}>
                      Vídeo · {resolveAdMediaUrl(item.creative.mediaUrl)}
                    </Text>
                  ) : null}
                  {item.status === 'active' ? (
                    <Pressable
                      onPress={async () => {
                        try {
                          await pauseCampaign(item.id);
                          setInfo('Campanha pausada. Novas sessões já não a vêem.');
                          await load();
                        } catch (err) {
                          setError(err.message);
                        }
                      }}
                      style={{ marginTop: 10 }}
                    >
                      <Text style={{ color: colors.gold, fontWeight: '700' }}>Pausar</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Wizard({ step, setStep, draft, setField, advertiser, busy, onCancel, onSubmit, measurement }) {
  return (
    <View style={panelStyle}>
      <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800' }}>
        CAMPANHA · {step} DE 7 · {STEPS[step - 1].title}
      </Text>
      {step === 1 ? (
        <>
          <Text style={{ color: colors.text, fontWeight: '700', marginTop: 12, marginBottom: 8 }}>
            O que quer com este anúncio?
          </Text>
          {[
            { id: 'brand', label: 'Notoriedade — ser visto até ao fim' },
            { id: 'traffic', label: 'Tráfego — abrir a página da empresa' },
            { id: 'awareness', label: 'Presença de marca — ser visto até ao fim' },
          ].map((o) => (
            <Pressable key={o.id} onPress={() => setField('objective', o.id)} style={choice(draft.objective === o.id)}>
              <Text style={{ color: colors.text }}>{o.label}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Text style={{ color: colors.text, marginTop: 12 }}>Anúncio em nome de</Text>
          <Text style={{ color: colors.gold, fontWeight: '700', marginTop: 6 }}>{advertiser.companyName}</Text>
          <Text style={{ color: colors.muted }}>{advertiser.contactEmail}</Text>
          <FieldLabel>Nome da campanha</FieldLabel>
          <TextInput
            value={draft.name}
            onChangeText={(v) => setField('name', v)}
            style={inputStyle}
            placeholder="Ex.: Unitel · cinema em casa"
            placeholderTextColor={colors.muted}
          />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Text style={{ color: colors.muted, marginTop: 12, marginBottom: 8, lineHeight: 20 }}>
            Ligação HTTPS para um ficheiro MP4, ou um vídeo já carregado na MinhaTela (/uploads/ads/…).
          </Text>
          <FieldLabel>Vídeo do anúncio</FieldLabel>
          <TextInput
            value={draft.mediaUrl}
            onChangeText={(v) => setField('mediaUrl', v)}
            style={inputStyle}
            autoCapitalize="none"
            placeholder="https://…"
            placeholderTextColor={colors.muted}
          />
          {draft.mediaUrl ? (
            <Text style={{ color: colors.gold, fontSize: 12 }}>Pré-visualização: {draft.mediaUrl}</Text>
          ) : null}
        </>
      ) : null}
      {step === 4 ? (
        <>
          <FieldLabel>Página ao tocar (HTTPS)</FieldLabel>
          <TextInput
            value={draft.clickUrl}
            onChangeText={(v) => setField('clickUrl', v)}
            style={inputStyle}
            autoCapitalize="none"
            placeholder={draft.objective === 'traffic' ? 'Obrigatório para tráfego' : 'Opcional'}
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Texto do botão</FieldLabel>
          {['Saber mais', 'Visitar', 'Ver oferta'].map((c) => (
            <Pressable key={c} onPress={() => setField('ctaLabel', c)} style={choice(draft.ctaLabel === c)}>
              <Text style={{ color: colors.text }}>{c}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
      {step === 5 ? (
        <>
          <Text style={{ color: colors.text, marginTop: 12, fontWeight: '700' }}>Antes do filme gratuito</Text>
          <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 20 }}>
            Angola. Sem idade, bairro ou interesses — a MinhaTela não tem esses dados de forma legítima.
          </Text>
          <FieldLabel>Categoria de conteúdo (opcional)</FieldLabel>
          <TextInput
            value={draft.contentCategory}
            onChangeText={(v) => setField('contentCategory', v)}
            style={inputStyle}
            placeholder="Ex.: Cinema Angolano"
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Máximo por pessoa e por dia (0 = sem limite)</FieldLabel>
          <TextInput
            value={draft.frequencyCapPerDay}
            onChangeText={(v) => setField('frequencyCapPerDay', v)}
            style={inputStyle}
            keyboardType="numeric"
            placeholderTextColor={colors.muted}
          />
        </>
      ) : null}
      {step === 6 ? (
        <>
          <FieldLabel>Orçamento total (Kz)</FieldLabel>
          <TextInput
            value={draft.budgetKz}
            onChangeText={(v) => setField('budgetKz', v)}
            style={inputStyle}
            keyboardType="numeric"
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Início</FieldLabel>
          <TextInput value={draft.startsAt} onChangeText={(v) => setField('startsAt', v)} style={inputStyle} />
          <FieldLabel>Fim</FieldLabel>
          <TextInput value={draft.endsAt} onChangeText={(v) => setField('endsAt', v)} style={inputStyle} />
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            {measurement?.note} Cada visualização completa custa {measurement?.unitKz || '—'} Kz. Sem
            estimativa de alcance.
          </Text>
        </>
      ) : null}
      {step === 7 ? (
        <>
          <Text style={{ color: colors.text, marginTop: 12, lineHeight: 22 }}>
            {draft.name || 'Sem nome'} · {draft.objective === 'traffic' ? 'Tráfego' : 'Notoriedade'}
            {'\n'}
            {Number(draft.budgetKz || 0).toLocaleString('pt-AO')} Kz · {draft.startsAt} → {draft.endsAt}
            {'\n'}
            Antes do filme · Angola
            {'\n'}
            Vídeo: {draft.mediaUrl || '—'}
            {draft.clickUrl ? `\nDestino: ${draft.clickUrl}` : ''}
          </Text>
          <Text style={{ color: colors.gold, marginTop: 12, lineHeight: 20 }}>
            Não entra no ar sozinha. A equipa MinhaTela confirma.
          </Text>
        </>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <PrimaryButton label="Cancelar" variant="outline" onPress={onCancel} style={{ flexGrow: 1 }} />
        {step > 1 ? (
          <PrimaryButton label="Anterior" variant="outline" onPress={() => setStep(step - 1)} style={{ flexGrow: 1 }} />
        ) : null}
        {step < 7 ? (
          <PrimaryButton label="Continuar" onPress={() => setStep(step + 1)} style={{ flexGrow: 1 }} />
        ) : (
          <PrimaryButton
            label="Enviar à MinhaTela"
            variant="gold"
            loading={busy}
            onPress={onSubmit}
            style={{ flexGrow: 1 }}
          />
        )}
      </View>
    </View>
  );
}

function choice(active) {
  return {
    borderWidth: 1,
    borderColor: active ? colors.gold : colors.border,
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: active ? 'rgba(247,212,23,0.08)' : '#181818',
  };
}

function MiniStat({ label, value, gold }) {
  return (
    <View
      style={{
        flexGrow: 1,
        minWidth: 120,
        backgroundColor: '#111111',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.border,
        borderTopWidth: 2,
        borderTopColor: gold ? colors.gold : colors.red,
        padding: 12,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, marginTop: 4 }}>{value}</Text>
    </View>
  );
}

const panelStyle = {
  backgroundColor: '#111111',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.border,
  padding: 16,
  marginBottom: 14,
};

const inputStyle = {
  backgroundColor: '#181818',
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 4,
  color: colors.text,
  paddingHorizontal: 12,
  paddingVertical: 12,
  marginBottom: 12,
};
