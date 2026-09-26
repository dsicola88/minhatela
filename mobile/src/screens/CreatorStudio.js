import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  useWindowDimensions,
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
} from '../services/creatorStudio';
import { fetchMyPayouts, requestPayout } from '../services/payouts';

const STATUS_LABEL = {
  draft: 'Rascunho',
  submitted: 'Submetido',
  under_review: 'Em revisão',
  approved: 'Aprovado',
  published: 'Publicado',
  rejected: 'Rejeitado',
  archived: 'Arquivado',
  pending: 'Pendente',
  active: 'Activo',
};

export default function CreatorStudio({ onBack }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      setError(err.message || 'Falha ao carregar Creator Studio');
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
          CREATOR STUDIO
        </Text>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
          Estúdio de Criadores
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 24, lineHeight: 22 }}>
          Submeta filmes, séries e documentários. Nada é publicado sem revisão da MinhaTela.
        </Text>

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
              Tornar-se criador
            </Text>
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
            <FieldLabel>IBAN (payouts)</FieldLabel>
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
                {STATUS_LABEL[creator.status] || creator.status} · {creator.type}
              </Text>
              {creator.status !== 'active' ? (
                <Text style={{ color: colors.muted, marginTop: 10 }}>
                  Aguarda aprovação administrativa antes de submeter conteúdo.
                </Text>
              ) : null}
            </View>

            {data.analytics ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
                <Stat label="Publicados" value={data.analytics.content.published} />
                <Stat label="Submissões" value={data.analytics.content.submitted} />
                <Stat label="Views" value={data.analytics.views} />
                <Stat label="Receita (Kz)" value={data.analytics.revenueKz} gold />
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
                  Payouts
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
                  label="Pedir payout IBAN"
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
                    Os meus conteúdos
                  </Text>
                  <PrimaryButton
                    label={showForm ? 'Fechar' : 'Novo conteúdo'}
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
                    <FieldLabel>Poster URL</FieldLabel>
                    <TextInput
                      value={contentForm.posterUrl}
                      onChangeText={(v) => setContentForm((s) => ({ ...s, posterUrl: v }))}
                      style={inputStyle}
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                    />
                    <FieldLabel>Bunny Video ID</FieldLabel>
                    <TextInput
                      value={contentForm.bunnyVideoId}
                      onChangeText={(v) => setContentForm((s) => ({ ...s, bunnyVideoId: v }))}
                      style={inputStyle}
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                    />
                    <FieldLabel>Monetização (avod | svod | tvod)</FieldLabel>
                    <TextInput
                      value={contentForm.monetization}
                      onChangeText={(v) => setContentForm((s) => ({ ...s, monetization: v }))}
                      style={inputStyle}
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                    />
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
                    title="Sem conteúdos"
                    subtitle="Crie o primeiro rascunho e submeta para revisão."
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
                        {STATUS_LABEL[item.workflowStatus] || item.workflowStatus}
                        {' · '}
                        {String(item.monetization || '').toUpperCase()}
                      </Text>
                      {item.rejectionReason ? (
                        <Text style={{ color: colors.red, marginTop: 8 }}>
                          {item.rejectionReason}
                        </Text>
                      ) : null}
                      {item.workflowStatus === 'draft' || item.workflowStatus === 'rejected' ? (
                        <PrimaryButton
                          label="Submeter para revisão"
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
