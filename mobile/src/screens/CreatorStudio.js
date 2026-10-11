import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, FieldLabel } from '../components/ui';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { colors, layout } from '../theme/tokens';
import {
  registerCreator,
  fetchCreatorStudio,
  createCreatorContent,
  submitCreatorContent,
  createBunnyVideoSlot,
} from '../services/creatorStudio';
import { fetchMyPayouts, requestPayout } from '../services/payouts';

const STATUS_LABEL = {
  draft: 'Rascunho',
  submitted: 'Na equipa',
  under_review: 'Em revisão',
  approved: 'Aprovado',
  published: 'No catálogo',
  rejected: 'Recusado',
  archived: 'Arquivado',
  pending: 'À espera da equipa',
  active: 'Activo',
  suspended: 'Suspenso',
};

const TYPE_LABEL = {
  creator: 'Criador',
  filmmaker: 'Cineasta',
  producer: 'Produtor',
  production_company: 'Produtora',
};

const MONETIZATION = [
  { id: 'avod', label: 'Gratuito com anúncios' },
  { id: 'svod', label: 'Premium' },
  { id: 'tvod', label: 'Aluguer' },
];

export default function CreatorStudio({ onBack, onCompany }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [data, setData] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    displayName: '',
    type: 'filmmaker',
    bio: '',
    bankIban: '',
  });
  const [payouts, setPayouts] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('5000');
  const [contentForm, setContentForm] = useState({
    title: '',
    synopsisShort: '',
    posterUrl: '',
    monetization: 'avod',
    rentalPriceKz: '1500',
    bunnyVideoId: '',
    uploadDashboardUrl: '',
    genre: 'Cinema Angolano',
  });

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await fetchCreatorStudio();
      setData(result);
      if (result?.creator?.status === 'active') {
        const p = await fetchMyPayouts();
        setPayouts(p);
      }
    } catch (err) {
      setError(err.message || 'Não foi possível abrir o estúdio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRegister() {
    setBusy(true);
    setError('');
    try {
      await registerCreator(registerForm);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      await createCreatorContent({
        ...contentForm,
        rentalPriceKz:
          contentForm.monetization === 'tvod'
            ? Number(contentForm.rentalPriceKz)
            : null,
      });
      setShowForm(false);
      setContentForm({
        title: '',
        synopsisShort: '',
        posterUrl: '',
        monetization: 'avod',
        rentalPriceKz: '1500',
        bunnyVideoId: '',
        uploadDashboardUrl: '',
        genre: 'Cinema Angolano',
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(id) {
    setBusy(true);
    try {
      await submitCreatorContent(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateBunnySlot() {
    if (!contentForm.title.trim()) {
      setError('Indique o título antes de criar a ficha de vídeo');
      return;
    }
    if (contentForm.bunnyVideoId && contentForm.uploadDashboardUrl) {
      setInfo('A ficha já existe. Envie o ficheiro na janela que abrir.');
      Linking.openURL(contentForm.uploadDashboardUrl).catch(() => {});
      return;
    }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const data = await createBunnyVideoSlot({ title: contentForm.title.trim() });
      const url = data.upload?.dashboardUrl || '';
      setContentForm((s) => ({
        ...s,
        bunnyVideoId: data.bunnyVideoId || '',
        uploadDashboardUrl: url,
      }));
      setInfo(
        url
          ? 'Ficha de vídeo criada. Envie o ficheiro na janela que abrir; depois guarde o rascunho e envie à equipa.'
          : data.message || 'Ficha de vídeo criada.'
      );
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

  const creator = data?.creator;

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
          ESTÚDIO
        </Text>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
          Os seus filmes na MinhaTela
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 16, lineHeight: 22 }}>
          Candidatura → filme → a equipa revê → aparece na app. Nada entra no catálogo sozinho.
        </Text>
        {onCompany && creator?.status === 'active' ? (
          <Pressable onPress={onCompany} style={{ marginBottom: 20 }}>
            <Text style={{ color: colors.gold, fontWeight: '700' }}>Portal da produtora →</Text>
          </Pressable>
        ) : null}

        {data?.guide ? (
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
            <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>{data.guide.body}</Text>
          </View>
        ) : null}

        {info ? (
          <Text style={{ color: colors.gold, marginBottom: 16, lineHeight: 20 }}>{info}</Text>
        ) : null}
        {error ? <ErrorState message={error} onRetry={load} /> : null}

        {!creator ? (
          <View
            style={{
              backgroundColor: '#111111',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              borderTopWidth: 3,
              borderTopColor: colors.gold,
              padding: 20,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 14 }}>
              Pedir o estúdio
            </Text>
            <FieldLabel>Tipo de conta</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {[
                { id: 'creator', label: 'Criador de conteúdo' },
                { id: 'filmmaker', label: 'Cineasta independente' },
                { id: 'producer', label: 'Produtor' },
                { id: 'production_company', label: 'Produtora' },
              ].map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => setRegisterForm((s) => ({ ...s, type: opt.id }))}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: registerForm.type === opt.id ? colors.gold : colors.border,
                    backgroundColor: registerForm.type === opt.id ? '#2a2108' : '#181818',
                  }}
                >
                  <Text
                    style={{
                      color: registerForm.type === opt.id ? colors.gold : colors.textSecondary,
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <FieldLabel>Nome artístico / produtora</FieldLabel>
            <TextInput
              value={registerForm.displayName}
              onChangeText={(v) => setRegisterForm((s) => ({ ...s, displayName: v }))}
              style={inputStyle}
              placeholderTextColor={colors.muted}
              placeholder="Ex: Estúdios Baía"
            />
            <FieldLabel>Bio</FieldLabel>
            <TextInput
              value={registerForm.bio}
              onChangeText={(v) => setRegisterForm((s) => ({ ...s, bio: v }))}
              style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
              multiline
              placeholderTextColor={colors.muted}
            />
            <FieldLabel>IBAN para levantamentos</FieldLabel>
            <TextInput
              value={registerForm.bankIban}
              onChangeText={(v) => setRegisterForm((s) => ({ ...s, bankIban: v }))}
              style={inputStyle}
              placeholderTextColor={colors.muted}
              placeholder="AO06..."
            />
            <PrimaryButton
              label="Submeter candidatura"
              variant="gold"
              loading={busy}
              onPress={handleRegister}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <>
            <View
              style={{
                backgroundColor: '#111111',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 18,
                marginBottom: 20,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
                {creator.displayName}
              </Text>
              <Text style={{ color: colors.gold, marginTop: 4 }}>
                {creator.statusLabel || STATUS_LABEL[creator.status] || creator.status}
                {' · '}
                {creator.typeLabel || TYPE_LABEL[creator.type] || creator.type}
              </Text>
              {creator.status !== 'active' ? (
                <Text style={{ color: colors.muted, marginTop: 10 }}>
                  Ainda não pode enviar filmes. A decisão aparece também nas notificações.
                </Text>
              ) : null}
            </View>

            {data.analytics ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
                <Stat label="Publicados" value={data.analytics.content?.published || 0} />
                <Stat label="Submissões" value={data.analytics.content?.submitted || 0} />
                <Stat label="Visualizações" value={data.analytics.views || 0} />
                <Stat label="Espectadores" value={data.analytics.uniqueViewers || 0} />
                <Stat label="Na minha lista" value={data.analytics.subscribers || 0} />
                <Stat label="Receita (Kz)" value={data.analytics.revenueKz || 0} gold />
              </View>
            ) : null}

            {payouts?.balance ? (
              <View
                style={{
                  backgroundColor: '#111111',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 8 }}>
                  Levantamentos
                </Text>
                <Text style={{ color: colors.muted, marginBottom: 10 }}>
                  Disponível: {payouts.balance.availableKz.toLocaleString('pt-AO')} Kz · Mínimo 5.000 Kz
                </Text>
                <FieldLabel>Pedido (Kz)</FieldLabel>
                <TextInput
                  value={payoutAmount}
                  onChangeText={setPayoutAmount}
                  keyboardType="numeric"
                  style={inputStyle}
                  placeholderTextColor={colors.muted}
                />
                <PrimaryButton
                  label="Pedir levantamento para o IBAN"
                  variant="gold"
                  loading={busy}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      await requestPayout({ amountKz: Number(payoutAmount) });
                      const p = await fetchMyPayouts();
                      setPayouts(p);
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                {(payouts.payouts || []).slice(0, 5).map((p) => (
                  <Text key={p.id} style={{ color: colors.textSecondary, marginTop: 10 }}>
                    {p.amountKz.toLocaleString('pt-AO')} Kz · {p.status}
                  </Text>
                ))}
              </View>
            ) : null}

            {creator.status === 'active' ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
                    Os meus filmes
                  </Text>
                  <PrimaryButton
                    label={showForm ? 'Fechar' : 'Novo filme'}
                    variant={showForm ? 'outline' : 'primary'}
                    onPress={() => setShowForm((v) => !v)}
                    style={{ minWidth: 140 }}
                  />
                </View>

                {showForm ? (
                  <View
                    style={{
                      backgroundColor: '#111111',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 16,
                      marginBottom: 18,
                    }}
                  >
                    <FieldLabel>Título</FieldLabel>
                    <TextInput
                      value={contentForm.title}
                      onChangeText={(v) => setContentForm((s) => ({ ...s, title: v }))}
                      style={inputStyle}
                      placeholderTextColor={colors.muted}
                    />
                    <FieldLabel>Sinopse curta</FieldLabel>
                    <TextInput
                      value={contentForm.synopsisShort}
                      onChangeText={(v) => setContentForm((s) => ({ ...s, synopsisShort: v }))}
                      style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]}
                      multiline
                      placeholderTextColor={colors.muted}
                    />
                    <FieldLabel>Ligação do cartaz</FieldLabel>
                    <TextInput
                      value={contentForm.posterUrl}
                      onChangeText={(v) => setContentForm((s) => ({ ...s, posterUrl: v }))}
                      style={inputStyle}
                      placeholderTextColor={colors.muted}
                      placeholder="https://…"
                      autoCapitalize="none"
                    />
                    <FieldLabel>Ficheiro de vídeo</FieldLabel>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8, lineHeight: 18 }}>
                      {contentForm.bunnyVideoId
                        ? 'Ficha pronta. Envie o ficheiro se ainda não enviou, depois grave o rascunho.'
                        : 'Crie a ficha e envie o filme. A equipa só publica com o ficheiro pronto.'}
                    </Text>
                    <PrimaryButton
                      label={contentForm.bunnyVideoId ? 'Abrir envio de ficheiro de novo' : 'Criar ficha e enviar o filme'}
                      loading={busy}
                      onPress={handleCreateBunnySlot}
                      style={{ marginTop: 4, marginBottom: 12 }}
                    />
                    <FieldLabel>Como entra na app</FieldLabel>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {MONETIZATION.map((opt) => (
                        <Pressable
                          key={opt.id}
                          onPress={() => setContentForm((s) => ({ ...s, monetization: opt.id }))}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: contentForm.monetization === opt.id ? colors.gold : colors.border,
                            backgroundColor: contentForm.monetization === opt.id ? '#2a2108' : '#181818',
                          }}
                        >
                          <Text
                            style={{
                              color: contentForm.monetization === opt.id ? colors.gold : colors.textSecondary,
                              fontWeight: '700',
                              fontSize: 12,
                            }}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {contentForm.monetization === 'tvod' ? (
                      <>
                        <FieldLabel>Preço aluguer (Kz)</FieldLabel>
                        <TextInput
                          value={contentForm.rentalPriceKz}
                          onChangeText={(v) => setContentForm((s) => ({ ...s, rentalPriceKz: v }))}
                          style={inputStyle}
                          keyboardType="numeric"
                          placeholderTextColor={colors.muted}
                        />
                      </>
                    ) : null}
                    <PrimaryButton
                      label="Guardar rascunho"
                      loading={busy}
                      onPress={handleCreate}
                      style={{ marginTop: 12 }}
                    />
                  </View>
                ) : null}

                {(data.contents || []).length === 0 ? (
                  <EmptyState
                    title="Ainda sem filmes"
                    subtitle="Crie a ficha, envie o ficheiro e mande à equipa. Só depois aparece na app."
                  />
                ) : (
                  data.contents.map((item) => (
                    <View
                      key={item.id}
                      style={{
                        backgroundColor: '#111111',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: 14,
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
                        {item.title}
                      </Text>
                      <Text style={{ color: colors.gold, marginTop: 4 }}>
                        {item.workflowLabel || STATUS_LABEL[item.workflowStatus] || item.workflowStatus}
                        {' · '}
                        {item.monetizationLabel || item.monetization}
                      </Text>
                      {item.rejectionReason ? (
                        <Text style={{ color: colors.red, marginTop: 8 }}>
                          {item.rejectionReason}
                        </Text>
                      ) : null}
                      {item.workflowStatus === 'draft' || item.workflowStatus === 'rejected' ? (
                        <PrimaryButton
                          label="Enviar à equipa"
                          variant="gold"
                          loading={busy}
                          onPress={() => handleSubmit(item.id)}
                          style={{ marginTop: 12 }}
                        />
                      ) : null}
                    </View>
                  ))
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, gold }) {
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
        padding: 14,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 6 }}>
        {value}
      </Text>
    </View>
  );
}

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
