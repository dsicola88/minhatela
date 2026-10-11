import { ThemedStatusBar, PrimaryButton, FieldLabel } from '../components/ui';
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
import { Video, ResizeMode } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
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
  withdrawCampaign,
  fetchAdReports,
  resolveAdMediaUrl,
  uploadAdCreative,
} from '../services/ads';
import { fileKind, mediaKindFromUrl, previewUsesVideo } from './adCreativeKind';
import {
  PLACEMENT_SCREENS,
  containedRect,
  frameMock,
  mediaFileLabel,
} from './adPlacementFrame';
import { destinationFieldText, normalizePublicWebUrl } from './publicWebUrl';

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
      const destination = normalizePublicWebUrl(draft.clickUrl, {
        optional: draft.objective !== 'traffic',
      });
      if (!destination.ok) {
        setError(destination.message);
        setStep(4);
        return;
      }
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
          clickUrl: destination.url,
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
      <ThemedStatusBar />
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
          Anúncios antes dos filmes gratuitos, em Angola. O saldo desce só quando o anúncio é visto até ao fim.
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
        {error && !wizard ? <ErrorState message={error} onRetry={load} /> : null}

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
            formError={error}
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
                  {['draft', 'pending_review', 'paused'].includes(item.status) ? (
                    <Pressable
                      onPress={async () => {
                        try {
                          await withdrawCampaign(item.id);
                          await load();
                        } catch (err) {
                          setError(err.message);
                        }
                      }}
                      style={{ marginTop: 10 }}
                    >
                      <Text style={{ color: colors.red, fontWeight: '700' }}>Retirar campanha</Text>
                    </Pressable>
                  ) : null}
                  {item.creative?.mediaUrl ? (
                    <Text style={{ color: colors.muted, marginTop: 6 }} numberOfLines={1}>
                      {creativeKindLabel(item.creative)} · {mediaFileLabel(item.creative.mediaUrl)}
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

function Wizard({ step, setStep, draft, setField, advertiser, busy, onCancel, onSubmit, measurement, formError }) {
  const { width } = useWindowDimensions();
  const wideFormats = width >= 760;
  const [uploading, setUploading] = useState(false);
  const [stepError, setStepError] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const ready = creativeReady(draft, step);
  const pastedLink = /^https?:\/\//i.test(String(draft.mediaUrl || ''));

  async function loadFile(into) {
    setStepError('');
    setUploading(true);
    try {
      const expected = draft.mediaKind === 'video' ? 'video' : 'image';
      const file = await pickAdFile(expected);
      if (!file) return;
      const actual = fileKind(file);
      if (actual && actual !== expected && into === 'single') {
        setStepError(
          expected === 'video'
            ? 'Este ficheiro é uma imagem. Escolha o formato Imagem, ou carregue um MP4, WEBM ou MOV.'
            : 'Este ficheiro é um vídeo. Escolha o formato Vídeo, ou carregue um JPG, PNG ou WEBP.'
        );
        return;
      }
      if (into !== 'single' && actual === 'video') {
        setStepError('O carrossel aceita imagens (JPG, PNG ou WEBP)');
        return;
      }
      const uploaded = await uploadAdCreative(file);
      if (into !== 'single' && uploaded.mediaKind === 'video') {
        setStepError('O carrossel aceita imagens (JPG, PNG ou WEBP)');
        return;
      }
      if (into === 'single') {
        setPasteOpen(false);
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
            {
              id: 'brand',
              label: 'Notoriedade',
              hint: 'O anúncio passa antes do filme. O saldo desce quando é visto até ao fim.',
            },
            {
              id: 'traffic',
              label: 'Visitas ao site',
              hint: 'O mesmo anúncio, com um botão que abre a página da empresa.',
            },
          ].map((o) => {
            const selected = draft.objective === o.id || (o.id === 'brand' && draft.objective === 'awareness');
            return (
              <Pressable key={o.id} onPress={() => setField('objective', o.id)} style={choice(selected)}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{o.label}</Text>
                <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 20 }}>{o.hint}</Text>
              </Pressable>
            );
          })}
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
          <Text style={{ color: colors.text, fontWeight: '700', marginTop: 12, marginBottom: 4 }}>
            Formato do anúncio
          </Text>
          <Text style={{ color: colors.muted, marginBottom: 12, lineHeight: 20 }}>
            O anúncio ocupa o ecrã do filme, no telemóvel e no computador. Pode substituir ou remover o ficheiro a qualquer momento.
          </Text>
          <View style={{ flexDirection: wideFormats ? 'row' : 'column', gap: 8, marginBottom: 8 }}>
            {AD_FORMATS.map((format) => {
              const selected = draft.mediaKind === format.id;
              return (
                <Pressable
                  key={format.id}
                  onPress={() => {
                    setField('mediaKind', format.id);
                    setPasteOpen(false);
                    if (draft.mediaUrl && mediaKindFromUrl(draft.mediaUrl) !== format.id && format.id !== 'carousel') {
                      setField('mediaUrl', '');
                    }
                  }}
                  style={{
                    flex: wideFormats ? 1 : undefined,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.red : colors.border,
                    backgroundColor: colors.surface,
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '800' }}>{format.label}</Text>
                  <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 18 }}>{format.hint}</Text>
                  {selected ? (
                    <Text style={{ color: colors.red, fontWeight: '700', marginTop: 8, fontSize: 12 }}>
                      Selecionado
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {draft.mediaKind === 'carousel' ? (
            <>
              <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 8, lineHeight: 20 }}>
                De 2 a 10 imagens. Cada cartão pode ser substituído ou removido.
              </Text>
              {draft.cards.map((card, index) => (
                <View
                  key={`card-${index}`}
                  style={{
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: index === activeCard ? colors.red : colors.border,
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <Pressable onPress={() => setActiveCard(index)}>
                    <Text style={{ color: colors.text, fontWeight: '800' }}>Cartão {index + 1}</Text>
                  </Pressable>
                  {card.mediaUrl ? (
                    <MediaActions
                      label={mediaFileLabel(card.mediaUrl)}
                      uploading={uploading}
                      onReplace={() => {
                        setActiveCard(index);
                        loadFile(index);
                      }}
                      onRemove={() => {
                        if (draft.cards.length > 2) {
                          const next = draft.cards.filter((_, itemIndex) => itemIndex !== index);
                          setField('cards', next);
                          setActiveCard(Math.max(0, index - 1));
                        } else {
                          setField(
                            'cards',
                            draft.cards.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, mediaUrl: '' } : item
                            )
                          );
                        }
                      }}
                    />
                  ) : (
                    <Pressable
                      onPress={() => loadFile(index)}
                      disabled={uploading}
                      style={dropStyle()}
                    >
                      <Text style={{ color: colors.text, fontWeight: '800' }}>
                        {uploading ? 'A carregar…' : 'Escolher imagem'}
                      </Text>
                      <Text style={{ color: colors.muted, marginTop: 4 }}>JPG, PNG ou WEBP</Text>
                    </Pressable>
                  )}
                  {!String(card.mediaUrl || '').startsWith('/uploads/') ? (
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
                      style={[fieldStyle(), { marginTop: 8, marginBottom: 0 }]}
                      autoCapitalize="none"
                      placeholder="Ou cole uma ligação HTTPS"
                      placeholderTextColor={colors.muted}
                    />
                  ) : null}
                </View>
              ))}
              {draft.cards.length < 10 ? (
                <PrimaryButton
                  label="Adicionar cartão"
                  variant="outline"
                  onPress={() => {
                    setField('cards', [...draft.cards, { mediaUrl: '', mediaKind: 'image' }]);
                    setActiveCard(draft.cards.length);
                  }}
                />
              ) : null}
              <PlacementFrames
                url={previewableMedia(
                  draft.cards[activeCard]?.mediaUrl || draft.cards.find((card) => card.mediaUrl)?.mediaUrl
                )}
                kind="image"
                ctaLabel={draft.ctaLabel}
              />
            </>
          ) : (
            <>
              {draft.mediaUrl ? (
                <MediaActions
                  label={mediaFileLabel(draft.mediaUrl)}
                  uploading={uploading}
                  onReplace={() => loadFile('single')}
                  onRemove={() => {
                    setField('mediaUrl', '');
                    setPasteOpen(false);
                  }}
                />
              ) : (
                <Pressable onPress={() => loadFile('single')} disabled={uploading} style={dropStyle()}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>
                    {uploading
                      ? 'A carregar…'
                      : draft.mediaKind === 'video'
                        ? 'Escolher vídeo'
                        : 'Escolher imagem'}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>
                    {draft.mediaKind === 'video' ? 'MP4, WEBM ou MOV' : 'JPG, PNG ou WEBP'}
                  </Text>
                </Pressable>
              )}
              {!draft.mediaUrl && !pasteOpen ? (
                <Pressable onPress={() => setPasteOpen(true)} style={{ marginTop: 10 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Colar uma ligação HTTPS</Text>
                </Pressable>
              ) : null}
              {(pasteOpen || pastedLink) && !String(draft.mediaUrl || '').startsWith('/uploads/') ? (
                <TextInput
                  value={draft.mediaUrl}
                  onChangeText={(value) => setField('mediaUrl', value)}
                  style={[fieldStyle(), { marginTop: 10 }]}
                  autoCapitalize="none"
                  placeholder="https://"
                  placeholderTextColor={colors.muted}
                />
              ) : null}
              {draft.mediaKind === 'image' ? (
                <>
                  <Text style={{ color: colors.text, fontWeight: '700', marginTop: 8, marginBottom: 8 }}>
                    Tempo no ecrã
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {['5', '6', '10', '15'].map((seconds) => {
                      const selected = String(draft.imageSeconds) === seconds;
                      return (
                        <Pressable
                          key={seconds}
                          onPress={() => setField('imageSeconds', seconds)}
                          style={{
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected ? colors.red : colors.border,
                            borderRadius: 20,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={{ color: colors.text, fontWeight: '700' }}>{seconds} s</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              <PlacementFrames url={previewableMedia(draft.mediaUrl)} kind={draft.mediaKind} ctaLabel={draft.ctaLabel} />
            </>
          )}
        </>
      ) : null}
      {step === 4 ? (
        <>
          <Text style={{ color: colors.text, fontWeight: '800', marginTop: 12 }}>Site da empresa</Text>
          <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 10, lineHeight: 20 }}>
            {draft.objective === 'traffic'
              ? 'O botão abre esta página. Escreva o site como no browser.'
              : 'Opcional. Se preencher, o botão abre esta página.'}
          </Text>
          <View style={[fieldStyle(), { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
            <Text style={{ color: colors.muted, fontWeight: '800' }}>https://</Text>
            <TextInput
              value={destinationFieldText(draft.clickUrl)}
              onChangeText={(value) => {
                setStepError('');
                setField('clickUrl', value.replace(/^https?:\/\//i, ''));
              }}
              onBlur={() => {
                const next = normalizePublicWebUrl(draft.clickUrl, { optional: true });
                if (next.ok && next.url) setField('clickUrl', next.url);
              }}
              style={{ flex: 1, color: colors.text, paddingVertical: 12, paddingLeft: 6 }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="empresa.ao"
              placeholderTextColor={colors.muted}
            />
          </View>
          {normalizePublicWebUrl(draft.clickUrl, { optional: true }).url ? (
            <Text style={{ color: colors.success, marginTop: -4, marginBottom: 12 }}>
              Ligação segura: {normalizePublicWebUrl(draft.clickUrl, { optional: true }).url}
            </Text>
          ) : null}
          <FieldLabel>Texto do botão</FieldLabel>
          <TextInput
            value={draft.ctaLabel}
            onChangeText={(value) => setField('ctaLabel', value.slice(0, 32))}
            style={fieldStyle()}
            placeholder="Escreva o texto do botão"
            placeholderTextColor={colors.muted}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {['Saber mais', 'Visitar', 'Ver oferta'].map((label) => {
              const selected = draft.ctaLabel === label;
              return (
                <Pressable
                  key={label}
                  onPress={() => setField('ctaLabel', label)}
                  style={{
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.red : colors.border,
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <PlacementFrames
            url={creativePreviewUrl(draft)}
            kind={draft.mediaKind === 'carousel' ? 'image' : draft.mediaKind}
            ctaLabel={draft.ctaLabel}
          />
        </>
      ) : null}
      {step === 5 ? (
        <>
          <Text style={{ color: colors.text, fontWeight: '800', marginTop: 12, marginBottom: 8 }}>
            Onde o anúncio passa
          </Text>
          <View style={choice(true)}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>Antes do filme gratuito</Text>
            <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 20 }}>
              Angola · telemóvel e computador · quem abre um filme grátis
            </Text>
          </View>
          <FieldLabel>Tema dos filmes</FieldLabel>
          <TextInput
            value={draft.contentCategory}
            onChangeText={(v) => setField('contentCategory', v)}
            style={fieldStyle()}
            placeholder="Opcional. Ex.: Cinema angolano"
            placeholderTextColor={colors.muted}
          />
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>Vezes por pessoa, por dia</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['0', 'Sem limite'],
              ['1', '1'],
              ['2', '2'],
              ['3', '3'],
            ].map(([value, label]) => {
              const selected = String(draft.frequencyCapPerDay) === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setField('frequencyCapPerDay', value)}
                  style={{
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.red : colors.border,
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      {step === 6 ? (
        <>
          <FieldLabel>Orçamento (Kz)</FieldLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {['5000', '15000', '50000', '150000'].map((amount) => {
              const selected = String(draft.budgetKz) === amount;
              return (
                <Pressable
                  key={amount}
                  onPress={() => setField('budgetKz', amount)}
                  style={{
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.red : colors.border,
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {Number(amount).toLocaleString('pt-AO')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={draft.budgetKz}
            onChangeText={(v) => setField('budgetKz', v.replace(/[^\d]/g, ''))}
            style={fieldStyle()}
            keyboardType="numeric"
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Começa</FieldLabel>
          <DateField value={draft.startsAt} onChange={(value) => setField('startsAt', value)} />
          <FieldLabel>Termina</FieldLabel>
          <DateField value={draft.endsAt} onChange={(value) => setField('endsAt', value)} />
          <Text style={{ color: colors.text, lineHeight: 22 }}>
            {budgetSummary(draft.budgetKz, measurement?.unitKz)}
          </Text>
        </>
      ) : null}
      {step === 7 ? (
        <>
          <Text style={{ color: colors.text, marginTop: 12, lineHeight: 22 }}>
            {draft.name || 'Sem nome'} · {draft.objective === 'traffic' ? 'Visitas ao site' : 'Notoriedade'}
            {'\n'}
            {Number(draft.budgetKz || 0).toLocaleString('pt-AO')} Kz · {draft.startsAt} → {draft.endsAt}
            {'\n'}
            Antes do filme · Angola
            {'\n'}
            {creativeKindLabel(draft)}: {creativeSummary(draft)}
            {normalizePublicWebUrl(draft.clickUrl, { optional: true }).url
              ? `\nSite: ${normalizePublicWebUrl(draft.clickUrl, { optional: true }).url}`
              : ''}
            {draft.ctaLabel ? `\nBotão: ${draft.ctaLabel}` : ''}
          </Text>
          <PlacementFrames
            url={creativePreviewUrl(draft)}
            kind={draft.mediaKind === 'carousel' ? 'image' : draft.mediaKind}
            ctaLabel={draft.ctaLabel}
          />
          <Text style={{ color: colors.gold, marginTop: 12, lineHeight: 20 }}>
            A seguir paga por IBAN ou Multicaixa Express. O anúncio só entra na fila depois do pagamento.
          </Text>
        </>
      ) : null}

      {stepError || formError ? (
        <Text style={{ color: colors.red, marginTop: 12, lineHeight: 20 }}>{stepError || formError}</Text>
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
            onPress={() => {
              if (step === 4 && !acceptDestination(draft, setField, setStepError)) return;
              if (step === 6 && !acceptBudget(draft, setStepError)) return;
              setStepError('');
              setStep(step + 1);
            }}
            style={{ flexGrow: 1 }}
          />
        ) : (
          <PrimaryButton
            label="Continuar para o pagamento"
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

function acceptDestination(draft, setField, setStepError) {
  const required = draft.objective === 'traffic';
  const next = normalizePublicWebUrl(draft.clickUrl, { optional: !required });
  if (!next.ok) {
    setStepError(next.message);
    return false;
  }
  if (next.url) setField('clickUrl', next.url);
  return true;
}

function acceptBudget(draft, setStepError) {
  const amount = Number(draft.budgetKz);
  if (!Number.isFinite(amount) || amount < 5000) {
    setStepError('O orçamento mínimo é 5 000 Kz.');
    return false;
  }
  const start = new Date(`${draft.startsAt}T00:00:00`);
  const end = new Date(`${draft.endsAt}T23:59:59`);
  if (!(start < end)) {
    setStepError('A data de fim tem de ser depois do início.');
    return false;
  }
  return true;
}

function budgetSummary(budgetKz, unitKz) {
  const budget = Number(budgetKz);
  const unit = Number(unitKz) > 0 ? Number(unitKz) : 5;
  if (!Number.isFinite(budget) || budget < 5000) return 'Mínimo 5 000 Kz.';
  const views = Math.floor(budget / unit);
  return `${budget.toLocaleString('pt-AO')} Kz chegam para cerca de ${views.toLocaleString('pt-AO')} visualizações completas, a ${unit.toLocaleString('pt-AO')} Kz cada.`;
}

function DateField({ value, onChange }) {
  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'date',
      value: value || '',
      onChange: (event) => onChange(event.target.value),
      style: {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        background: colors.surfaceSecondary,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        padding: 12,
        marginBottom: 12,
        fontSize: 16,
      },
    });
  }
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      style={fieldStyle()}
      placeholder="AAAA-MM-DD"
      placeholderTextColor={colors.muted}
    />
  );
}

function previewableMedia(url) {
  const value = String(url || '').trim();
  if (/^https?:\/\//i.test(value) || value.startsWith('/uploads/')) return value;
  return '';
}

function creativePreviewUrl(draft) {
  if (draft.mediaKind === 'carousel') {
    return previewableMedia((draft.cards || []).find((card) => card.mediaUrl)?.mediaUrl);
  }
  return previewableMedia(draft.mediaUrl);
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
  return mediaFileLabel(draft.mediaUrl) || '—';
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
  const accept = kind === 'video' ? 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov' : 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      let settled = false;
      const finish = (file) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('focus', onFocus);
        resolve(file || null);
      };
      const onFocus = () => {
        setTimeout(() => finish(input.files?.[0] || null), 400);
      };
      input.addEventListener('cancel', () => finish(null));
      input.onchange = () => finish(input.files?.[0] || null);
      window.addEventListener('focus', onFocus);
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

function MediaActions({ label, uploading, onReplace, onRemove }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginTop: 10,
        flexWrap: 'wrap',
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '700', flexGrow: 1 }}>{label}</Text>
      <Pressable onPress={onReplace} disabled={uploading}>
        <Text style={{ color: colors.text, fontWeight: '800' }}>{uploading ? 'A carregar…' : 'Substituir'}</Text>
      </Pressable>
      <Pressable onPress={onRemove} disabled={uploading}>
        <Text style={{ color: colors.red, fontWeight: '800' }}>Remover</Text>
      </Pressable>
    </View>
  );
}

function dropStyle() {
  return {
    marginTop: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
  };
}

function PlacementFrames({ url, kind, ctaLabel }) {
  const { width } = useWindowDimensions();
  const [natural, setNatural] = useState(null);
  const uri = url ? resolveAdMediaUrl(url) : '';
  const detected = mediaKindFromUrl(url);
  const showVideo = previewUsesVideo(url, kind);

  useEffect(() => {
    setNatural(null);
  }, [uri]);

  if (!url) return null;
  if (detected === 'image' && kind === 'video') {
    return (
      <Text style={{ color: colors.red, marginTop: 12 }}>
        Este ficheiro é uma imagem. Escolha o formato Imagem para o ver no tamanho do ecrã.
      </Text>
    );
  }

  const sideBySide = width >= 900;
  const screens = [PLACEMENT_SCREENS.phone, PLACEMENT_SCREENS.desktop];

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: colors.text, fontWeight: '800' }}>Pré-visualização</Text>
      <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 12, lineHeight: 20 }}>
        O anúncio fica centrado no ecrã do filme, sem ser esticado.
      </Text>
      <View style={{ flexDirection: sideBySide ? 'row' : 'column', gap: 16, alignItems: 'flex-start' }}>
        {screens.map((screen) => {
          const maxWidth = screen.id === 'phone' ? 230 : sideBySide ? 520 : Math.min(width - 80, 640);
          const maxHeight = screen.id === 'phone' ? 460 : 300;
          const mock = frameMock(screen, maxWidth, maxHeight);
          const fit = natural
            ? containedRect(natural.width, natural.height, screen.width, screen.height)
            : null;
          const box = fit
            ? {
                width: Math.max(1, Math.round(fit.width * mock.scale)),
                height: Math.max(1, Math.round(fit.height * mock.scale)),
                x: Math.round(fit.x * mock.scale),
                y: Math.round(fit.y * mock.scale),
              }
            : { width: mock.width, height: mock.height, x: 0, y: 0 };
          return (
            <View key={screen.id} style={{ maxWidth: '100%' }}>
              <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>{screen.label}</Text>
              <View
                style={{
                  width: mock.width,
                  height: mock.height,
                  backgroundColor: '#000',
                  borderRadius: screen.id === 'phone' ? 24 : 8,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    left: box.x,
                    top: box.y,
                    width: box.width,
                    height: box.height,
                    overflow: 'hidden',
                  }}
                >
                  <FittedCreative
                    uri={uri}
                    showVideo={showVideo}
                    width={box.width}
                    height={box.height}
                    onSize={(next) => setNatural(next)}
                  />
                </View>
                <Text
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 12,
                    color: '#F7D417',
                    fontWeight: '700',
                    fontSize: 11,
                  }}
                >
                  Publicidade
                </Text>
                {ctaLabel ? (
                  <View
                    style={{
                      position: 'absolute',
                      right: 10,
                      bottom: 12,
                      backgroundColor: '#F7D417',
                      borderRadius: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '800', fontSize: 11 }}>{ctaLabel}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12, lineHeight: 18, maxWidth: mock.width }}>
                {screen.id === 'phone' ? 'Telemóvel, ecrã inteiro' : 'Computador, antes do filme'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function FittedCreative({ uri, showVideo, width, height, onSize }) {
  if (showVideo && Platform.OS === 'web') {
    return createElement('video', {
      src: uri,
      muted: true,
      playsInline: true,
      preload: 'metadata',
      onLoadedMetadata: (event) => {
        const video = event.currentTarget;
        if (video?.videoWidth) onSize({ width: video.videoWidth, height: video.videoHeight });
      },
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        backgroundColor: '#000',
      },
    });
  }
  if (showVideo) {
    return (
      <Video
        source={{ uri }}
        style={{ width, height }}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls
        onReadyForDisplay={(event) => {
          const size = event?.naturalSize;
          if (size?.width && size?.height) onSize({ width: size.width, height: size.height });
        }}
      />
    );
  }
  return (
    <Image
      source={{ uri }}
      resizeMode="contain"
      onLoad={(event) => {
        const source = event?.nativeEvent?.source;
        if (source?.width && source?.height) onSize({ width: source.width, height: source.height });
      }}
      style={{ width, height, backgroundColor: '#000' }}
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
