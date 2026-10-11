import { View, Text, TextInput, Pressable } from 'react-native';
import { PrimaryButton, FieldLabel, cardSurface, fieldSurface } from '../../components/ui';
import { colors } from '../../theme/tokens';

const STEPS = ['Informação', 'Vídeo', 'Direitos', 'Monetização', 'Revisão'];

const MONETIZATION = [
  {
    id: 'avod',
    label: 'Gratuito com anúncios',
    body: 'Qualquer pessoa vê. A receita registada é a visualização válida e a parte dos anúncios.',
  },
  {
    id: 'svod',
    label: 'Premium',
    body: 'Só entra quem tem assinatura. A assinatura ainda não credita o estúdio.',
  },
  {
    id: 'tvod',
    label: 'Aluguer',
    body: 'O espectador paga o preço em Kz. Essa cobrança ainda não credita o estúdio.',
  },
];

export default function FilmWizard({
  form,
  setForm,
  step,
  setStep,
  busy,
  onCreateSlot,
  onSaveDraft,
  onSubmit,
}) {
  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <View style={cardSurface()}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {STEPS.map((label, index) => (
          <Text
            key={label}
            style={{
              color: index === step ? colors.gold : colors.muted,
              fontSize: 12,
              fontWeight: '700',
            }}
          >
            {index + 1}. {label}
          </Text>
        ))}
      </View>

      {step === 0 ? (
        <>
          <FieldLabel>Título</FieldLabel>
          <TextInput value={form.title} onChangeText={(v) => patch('title', v)} style={fieldSurface()} placeholderTextColor={colors.muted} />
          <FieldLabel>Sinopse curta</FieldLabel>
          <TextInput
            value={form.synopsisShort}
            onChangeText={(v) => patch('synopsisShort', v)}
            style={[fieldSurface(), { minHeight: 72 }]}
            multiline
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Descrição</FieldLabel>
          <TextInput
            value={form.synopsisFull}
            onChangeText={(v) => patch('synopsisFull', v)}
            style={[fieldSurface(), { minHeight: 88 }]}
            multiline
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Género</FieldLabel>
          <TextInput value={form.genre} onChangeText={(v) => patch('genre', v)} style={fieldSurface()} placeholderTextColor={colors.muted} />
          <FieldLabel>Classificação etária</FieldLabel>
          <TextInput value={form.ageRating} onChangeText={(v) => patch('ageRating', v)} style={fieldSurface()} placeholder="12" placeholderTextColor={colors.muted} />
          <FieldLabel>Ano</FieldLabel>
          <TextInput value={form.releaseYear} onChangeText={(v) => patch('releaseYear', v)} keyboardType="numeric" style={fieldSurface()} placeholderTextColor={colors.muted} />
          <FieldLabel>Duração em segundos, se já souber</FieldLabel>
          <TextInput value={form.durationSeconds} onChangeText={(v) => patch('durationSeconds', v)} keyboardType="numeric" style={fieldSurface()} placeholderTextColor={colors.muted} />
          <FieldLabel>Ligação do cartaz</FieldLabel>
          <TextInput
            value={form.posterUrl}
            onChangeText={(v) => patch('posterUrl', v)}
            autoCapitalize="none"
            style={fieldSurface()}
            placeholder="https://…"
            placeholderTextColor={colors.muted}
          />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={helpStyle()}>
            {form.bunnyVideoId
              ? 'A ficha de vídeo existe. Envie o ficheiro na janela do fornecedor e volte para guardar.'
              : 'Crie a ficha e envie o ficheiro. Sem vídeo associado a equipa não recebe o filme.'}
          </Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            Progresso do envio: o fornecedor de vídeo mostra o progresso na janela dele. Este ecrã não recebe essa percentagem.
          </Text>
          <PrimaryButton
            label={form.bunnyVideoId ? 'Abrir o envio outra vez' : 'Criar ficha e enviar o filme'}
            loading={busy}
            onPress={onCreateSlot}
          />
          {form.bunnyVideoId ? (
            <Text style={{ color: colors.gold, marginTop: 12 }}>Ficha associada.</Text>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={helpStyle()}>
            A MinhaTela distribui em Angola. Ao confirmar, fica registada uma declaração com data. Isto não prova a propriedade do filme. Uma reclamação pode retirar o título do catálogo.
          </Text>
          <Pressable onPress={() => patch('rightsConfirmed', !form.rightsConfirmed)} style={{ flexDirection: 'row', gap: 10 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderWidth: 1,
                borderColor: colors.gold,
                backgroundColor: form.rightsConfirmed ? colors.gold : 'transparent',
              }}
            />
            <Text style={{ color: colors.text, flex: 1, lineHeight: 20 }}>
              Confirmo que controlo os direitos necessários e autorizo a distribuição deste filme na MinhaTela.
            </Text>
          </Pressable>
        </>
      ) : null}

      {step === 3 ? (
        <>
          {MONETIZATION.map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => patch('monetization', opt.id)}
              style={{
                borderWidth: 1,
                borderColor: form.monetization === opt.id ? colors.gold : colors.border,
                borderRadius: 6,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>{opt.label}</Text>
              <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 18 }}>{opt.body}</Text>
            </Pressable>
          ))}
          {form.monetization === 'tvod' ? (
            <>
              <FieldLabel>Preço do aluguer (Kz)</FieldLabel>
              <TextInput
                value={form.rentalPriceKz}
                onChangeText={(v) => patch('rentalPriceKz', v)}
                keyboardType="numeric"
                style={fieldSurface()}
                placeholderTextColor={colors.muted}
              />
            </>
          ) : null}
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Summary label="Título" value={form.title} />
          <Summary label="Sinopse" value={form.synopsisShort} />
          <Summary label="Cartaz" value={form.posterUrl} />
          <Summary label="Vídeo" value={form.bunnyVideoId ? 'Ficha associada' : 'Em falta'} />
          <Summary label="Direitos" value={form.rightsConfirmed ? 'Confirmados para este envio' : 'Por confirmar'} />
          <Summary
            label="Acesso"
            value={MONETIZATION.find((item) => item.id === form.monetization)?.label || form.monetization}
          />
          {!form.bunnyVideoId ? (
            <Text style={{ color: colors.red, marginTop: 8 }}>O envio à equipa fica bloqueado até existir ficheiro.</Text>
          ) : null}
          {!form.rightsConfirmed ? (
            <Text style={{ color: colors.red, marginTop: 8 }}>O envio à equipa fica bloqueado sem a confirmação de direitos.</Text>
          ) : null}
          <PrimaryButton label="Guardar rascunho" loading={busy} onPress={onSaveDraft} style={{ marginTop: 16 }} />
          <PrimaryButton
            label="Enviar para análise"
            variant="gold"
            loading={busy}
            disabled={!form.bunnyVideoId || !form.rightsConfirmed}
            onPress={onSubmit}
            style={{ marginTop: 10 }}
          />
        </>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
        <PrimaryButton label="Anterior" variant="outline" disabled={step === 0} onPress={() => setStep((n) => Math.max(0, n - 1))} />
        {step < 4 ? (
          <PrimaryButton label="Seguinte" onPress={() => setStep((n) => Math.min(4, n + 1))} />
        ) : null}
      </View>
    </View>
  );
}

function Summary({ label, value }) {
  return (
    <Text style={{ color: colors.textSecondary, marginTop: 8, lineHeight: 20 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{label}: </Text>
      {value || '—'}
    </Text>
  );
}

function helpStyle() {
  return { color: colors.textSecondary, lineHeight: 20, marginBottom: 12 };
}
