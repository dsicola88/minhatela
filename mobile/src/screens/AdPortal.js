import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import { PrimaryButton, FieldLabel } from '../components/ui';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { colors, layout } from '../theme/tokens';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import WorkspaceBar from '../components/WorkspaceBar';
import {
  registerAdvertiser,
  fetchAdPortal,
  createCampaign,
  pauseCampaign,
  fetchAdReports,
  resolveAdMediaUrl,
  uploadAdCreative,
} from '../services/ads';

const STEPS = [
  { id: 1, title: 'Objectivo' },
  { id: 2, title: 'Empresa' },
  { id: 3, title: 'Criativo' },
  { id: 4, title: 'Destino' },
  { id: 5, title: 'Onde passa' },
  { id: 6, title: 'Orçamento' },
  { id: 7, title: 'Rever' },
];

const AD_FORMATS = [
  { id: 'image', label: 'Imagem', hint: 'Uma imagem no ecrã, como um anúncio de display.' },
  { id: 'video', label: 'Vídeo', hint: 'Um vídeo curto antes do filme.' },
  { id: 'carousel', label: 'Carrossel', hint: '2 a 10 imagens, como no Meta.' },
];

const emptyDraft = () => ({
  objective: 'brand',
  name: '',
  budgetKz: '50000',
  placement: 'pre_roll',
  startsAt: new Date().toISOString().slice(0, 10),
  endsAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  mediaKind: 'image',
  mediaUrl: '',
  imageSeconds: '6',
  cards: [
    { mediaUrl: '', mediaKind: 'image' },
    { mediaUrl: '', mediaKind: 'image' },
  ],
  clickUrl: '',
  ctaLabel: 'Saber mais',
  contentCategory: '',
  frequencyCapPerDay: '0',
});

export default function AdPortal({ onCatalog, onAccount }) {
  const router = useRouter();
  const { refreshSession } = useAuth();
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
          mediaKind: draft.mediaKind,
          mediaUrl: draft.mediaKind === 'carousel' ? undefined : draft.mediaUrl,
          cards:
            draft.mediaKind === 'carousel'
              ? draft.cards.filter((card) => String(card.mediaUrl || '').trim())
              : undefined,
          durationSeconds: draft.mediaKind === 'image' ? Number(draft.imageSeconds) || 6 : undefined,
          clickUrl: draft.clickUrl,
          ctaLabel: draft.ctaLabel,
        },
      });
      setWizard(false);
      setStep(1);
      setDraft(emptyDraft());
      await load();
      if (res.campaign?.id) {
        router.push({
          pathname: '/checkout',
          params: {
            type: 'ad_campaign',
            campaignId: res.campaign.id,
            title: res.campaign.name || draft.name,
            priceKz: String(res.campaign.budgetKz || draft.budgetKz),
          },
        });
        return;
      }
      setInfo(res.message || 'Campanha criada. Pague o orçamento para a MinhaTela a poder pôr no ar.');
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
      <WorkspaceBar
        product="Anúncios"
        links={[
          {
            label: 'Campanhas',
            active: !wizard,
            onPress: () => {
              setWizard(false);
            },
          },
          advertiser
            ? {
                label: 'Nova campanha',
                onPress: () => {
                  setWizard(true);
                  setStep(1);
                },
              }
            : null,
          onAccount ? { label: 'Conta', onPress: onAccount } : null,
        ].filter(Boolean)}
        onCatalog={onCatalog}
      />
      <ScrollView
        contentContainerStyle={{
          padding: isCompact ? 16 : 32,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 80,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
          Consola de publicidade
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 22, lineHeight: 22 }}>
          Empresa ou particular: cria a campanha, paga o orçamento (IBAN ou Multicaixa Express) e a
          MinhaTela confirma. Só então o anúncio passa antes dos filmes gratuitos. Só a visualização
          completa gasta o saldo pago. Angola.
        </Text>

        {data?.guide && !wizard ? (
          <View
            style={{
              backgroundColor: colors.card,
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
          <View style={panelStyle()}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              Identificar empresa ou particular
            </Text>
            <FieldLabel>Empresa</FieldLabel>
            <TextInput
              value={companyName}
              onChangeText={setCompanyName}
              style={fieldStyle()}
              placeholder="Empresa ou o seu nome"
              placeholderTextColor={colors.muted}
            />
            <FieldLabel>Email de contacto</FieldLabel>
            <TextInput
              value={contactEmail}
              onChangeText={setContactEmail}
              style={fieldStyle()}
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
                  await refreshSession?.();
                  setInfo('Consola de anúncios aberta. Crie a primeira campanha e pague o orçamento.');
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
            <View style={panelStyle()}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>
                {advertiser.companyName}
              </Text>
              <Text style={{ color: colors.muted }}>{advertiser.contactEmail}</Text>
              <Text style={{ color: colors.gold, marginTop: 8, fontWeight: '700' }}>
                Conta aberta
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 20 }}>
                Criar campanha não publica. Pagar não publica. Só a MinhaTela põe no ar depois do
                pagamento confirmado.
              </Text>
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
                style={{ ...fieldStyle(), flex: 1, minWidth: 180, marginBottom: 0 }}
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
                <View key={item.id} style={panelStyle()}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: colors.gold, marginTop: 4 }}>
                    {item.lifecycle?.label || item.statusLabel} · {item.placementLabel}
                  </Text>
                  {item.lifecycle?.hint ? (
                    <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>
                      {item.lifecycle.hint}
                    </Text>
                  ) : null}
                  <Text style={{ color: colors.muted, marginTop: 6 }}>
                    {item.startsAt ? new Date(item.startsAt).toLocaleDateString('pt-AO') : '—'} →{' '}
                    {item.endsAt ? new Date(item.endsAt).toLocaleDateString('pt-AO') : '—'}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>
                    Orçamento {Number(item.budgetKz || 0).toLocaleString('pt-AO')} Kz · gasto{' '}
                    {Number(item.spentKz || 0).toLocaleString('pt-AO')} Kz · saldo{' '}
                    {Number(item.remainingKz || 0).toLocaleString('pt-AO')} Kz
                  </Text>
                  {item.lifecycle?.canPay ? (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/checkout',
                          params: {
                            type: 'ad_campaign',
                            campaignId: item.id,
                            title: item.name,
                            priceKz: String(item.budgetKz || ''),
                          },
                        })
                      }
                      style={{ marginTop: 10 }}
                    >
                      <Text style={{ color: colors.gold, fontWeight: '700' }}>Pagar orçamento</Text>
                    </Pressable>
                  ) : null}
                  {item.rejectionReason ? (
                    <Text style={{ color: colors.red, marginTop: 6 }}>Motivo: {item.rejectionReason}</Text>
                  ) : null}
                  {item.creative?.mediaUrl ? (
                    <Text style={{ color: colors.muted, marginTop: 6 }} numberOfLines={1}>
                      {creativeKindLabel(item.creative)} · {resolveAdMediaUrl(item.creative.mediaUrl)}
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
  const [uploading, setUploading] = useState(false);
  const [stepError, setStepError] = useState('');
  const ready = creativeReady(draft, step);

  async function loadFile(into) {
    setStepError('');
    setUploading(true);
    try {
      const file = await pickAdFile(draft.mediaKind === 'video' ? 'video' : 'image');
      if (!file) return;
      const uploaded = await uploadAdCreative(file);
      if (into !== 'single' && uploaded.mediaKind === 'video') {
        setStepError('O carrossel aceita imagens (JPG, PNG ou WEBP)');
        return;
      }
      if (into === 'single') {
        setField('mediaUrl', uploaded.mediaUrl);
        if (uploaded.mediaKind === 'video') setField('mediaKind', 'video');
        if (uploaded.mediaKind === 'image' && draft.mediaKind === 'video') setField('mediaKind', 'image');
      } else {
        setField(
          'cards',
          draft.cards.map((card, index) =>
            index === into ? { ...card, mediaUrl: uploaded.mediaUrl, mediaKind: 'image' } : card
          )
        );
      }
    } catch (err) {
      setStepError(err.message || 'Não foi possível carregar o ficheiro');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={panelStyle()}>
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
            style={fieldStyle()}
            placeholder="Ex.: Unitel · cinema em casa"
            placeholderTextColor={colors.muted}
          />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Text style={{ color: colors.text, fontWeight: '700', marginTop: 12, marginBottom: 8 }}>
            Formato do anúncio
          </Text>
          {AD_FORMATS.map((format) => (
            <Pressable
              key={format.id}
              onPress={() => setField('mediaKind', format.id)}
              style={choice(draft.mediaKind === format.id)}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>{format.label}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{format.hint}</Text>
            </Pressable>
          ))}
          {draft.mediaKind === 'carousel' ? (
            <>
              <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 8, lineHeight: 20 }}>
                Cada cartão é uma imagem. Carregue o ficheiro ou cole uma ligação HTTPS.
              </Text>
              {draft.cards.map((card, index) => (
                <View key={`card-${index}`} style={{ marginBottom: 8 }}>
                  <FieldLabel>Cartão {index + 1}</FieldLabel>
                  <PrimaryButton
                    label={uploading ? 'A carregar…' : 'Carregar imagem'}
                    variant="outline"
                    disabled={uploading}
                    onPress={() => loadFile(index)}
                    style={{ marginBottom: 8 }}
                  />
                  <TextInput
                    value={card.mediaUrl}
                    onChangeText={(value) =>
                      setField(
                        'cards',
                        draft.cards.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, mediaUrl: value } : item
                        )
                      )
                    }
                    style={fieldStyle()}
                    autoCapitalize="none"
                    placeholder="https://… ou ficheiro carregado"
                    placeholderTextColor={colors.muted}
                  />
                  <CreativePreview url={card.mediaUrl} kind="image" />
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {draft.cards.length < 10 ? (
                  <PrimaryButton
                    label="Adicionar cartão"
                    variant="outline"
                    onPress={() =>
                      setField('cards', [...draft.cards, { mediaUrl: '', mediaKind: 'image' }])
                    }
                  />
                ) : null}
                {draft.cards.length > 2 ? (
                  <PrimaryButton
                    label="Remover último"
                    variant="outline"
                    onPress={() => setField('cards', draft.cards.slice(0, -1))}
                  />
                ) : null}
              </View>
            </>
          ) : (
            <>
              <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 8, lineHeight: 20 }}>
                {draft.mediaKind === 'video'
                  ? 'Carregue um MP4, WEBM ou MOV, ou cole uma ligação HTTPS.'
                  : 'Carregue um JPG, PNG ou WEBP, ou cole uma ligação HTTPS.'}
              </Text>
              <PrimaryButton
                label={uploading ? 'A carregar…' : draft.mediaKind === 'video' ? 'Carregar vídeo' : 'Carregar imagem'}
                variant="outline"
                disabled={uploading}
                onPress={() => loadFile('single')}
                style={{ marginBottom: 8 }}
              />
              <TextInput
                value={draft.mediaUrl}
                onChangeText={(value) => setField('mediaUrl', value)}
                style={fieldStyle()}
                autoCapitalize="none"
                placeholder="https://…"
                placeholderTextColor={colors.muted}
              />
              {draft.mediaKind === 'image' ? (
                <>
                  <FieldLabel>Tempo no ecrã</FieldLabel>
                  {['5', '6', '10', '15'].map((seconds) => (
                    <Pressable
                      key={seconds}
                      onPress={() => setField('imageSeconds', seconds)}
                      style={choice(String(draft.imageSeconds) === seconds)}
                    >
                      <Text style={{ color: colors.text }}>{seconds} segundos</Text>
                    </Pressable>
                  ))}
                </>
              ) : null}
              <CreativePreview url={draft.mediaUrl} kind={draft.mediaKind} />
            </>
          )}
          {stepError ? (
            <Text style={{ color: colors.red, marginTop: 8 }}>{stepError}</Text>
          ) : null}
        </>
      ) : null}
      {step === 4 ? (
        <>
          <FieldLabel>Página ao tocar (HTTPS)</FieldLabel>
          <TextInput
            value={draft.clickUrl}
            onChangeText={(v) => setField('clickUrl', v)}
            style={fieldStyle()}
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
            style={fieldStyle()}
            placeholder="Ex.: Cinema Angolano"
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Máximo por pessoa e por dia (0 = sem limite)</FieldLabel>
          <TextInput
            value={draft.frequencyCapPerDay}
            onChangeText={(v) => setField('frequencyCapPerDay', v)}
            style={fieldStyle()}
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
            style={fieldStyle()}
            keyboardType="numeric"
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Início</FieldLabel>
          <TextInput value={draft.startsAt} onChangeText={(v) => setField('startsAt', v)} style={fieldStyle()} />
          <FieldLabel>Fim</FieldLabel>
          <TextInput value={draft.endsAt} onChangeText={(v) => setField('endsAt', v)} style={fieldStyle()} />
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
            {creativeKindLabel(draft)}: {creativeSummary(draft)}
            {draft.clickUrl ? `\nDestino: ${draft.clickUrl}` : ''}
          </Text>
          <Text style={{ color: colors.gold, marginTop: 12, lineHeight: 20 }}>
            A seguir paga o orçamento (IBAN ou Multicaixa Express). Sem pagamento confirmado o
            SuperAdmin não põe o anúncio no ar.
          </Text>
        </>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <PrimaryButton label="Cancelar" variant="outline" onPress={onCancel} style={{ flexGrow: 1 }} />
        {step > 1 ? (
          <PrimaryButton label="Anterior" variant="outline" onPress={() => setStep(step - 1)} style={{ flexGrow: 1 }} />
        ) : null}
        {step < 7 ? (
          <PrimaryButton
            label="Continuar"
            disabled={!ready || uploading}
            onPress={() => setStep(step + 1)}
            style={{ flexGrow: 1 }}
          />
        ) : (
          <PrimaryButton
            label="Criar e pagar"
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

function creativeKindLabel(creative) {
  if (creative?.mediaKind === 'image') return 'Imagem';
  if (creative?.mediaKind === 'carousel') return 'Carrossel';
  return 'Vídeo';
}

function creativeSummary(draft) {
  if (draft.mediaKind === 'carousel') {
    const count = (draft.cards || []).filter((card) => String(card.mediaUrl || '').trim()).length;
    return `${count} imagens`;
  }
  return draft.mediaUrl || '—';
}

function creativeReady(draft, step) {
  if (step === 2) return Boolean(String(draft.name || '').trim());
  if (step !== 3) return true;
  if (draft.mediaKind === 'carousel') {
    return (draft.cards || []).filter((card) => String(card.mediaUrl || '').trim()).length >= 2;
  }
  return Boolean(String(draft.mediaUrl || '').trim());
}

async function pickAdFile(kind) {
  const accept = kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp,image/gif';
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => resolve(input.files?.[0] || null);
      input.click();
    });
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: kind === 'video' ? ['video/mp4', 'video/webm', 'video/quicktime'] : ['image/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  return result.assets?.[0] || null;
}

function CreativePreview({ url, kind }) {
  if (!url) return null;
  const uri = resolveAdMediaUrl(url);
  if (kind === 'video') {
    if (Platform.OS === 'web') {
      return createElement('video', {
        src: uri,
        controls: true,
        style: { width: '100%', maxHeight: 220, background: '#000', marginBottom: 12 },
      });
    }
    return <Text style={{ color: colors.muted, marginBottom: 12 }}>Vídeo carregado</Text>;
  }
  return (
    <Image
      source={{ uri }}
      resizeMode="contain"
      style={{ width: '100%', height: 180, marginBottom: 12, backgroundColor: colors.surfaceSecondary }}
    />
  );
}

function choice(active) {
  return {
    borderWidth: 1,
    borderColor: active ? colors.gold : colors.border,
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: active ? 'rgba(247,212,23,0.12)' : colors.surfaceSecondary,
  };
}

function MiniStat({ label, value, gold }) {
  return (
    <View
      style={{
        flexGrow: 1,
        minWidth: 120,
        backgroundColor: colors.card,
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

function panelStyle() {
  return {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  };
}

function fieldStyle() {
  return {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  };
}
