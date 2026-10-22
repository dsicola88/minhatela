import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { PrimaryButton, FieldLabel, cardSurface, fieldSurface } from '../../components/ui';
import { colors } from '../../theme/tokens';
import { destinationFieldText, normalizePublicWebUrl } from '../publicWebUrl';

const STEPS = [
  { title: 'Ficha', hint: 'O que o público lê no cartaz.' },
  { title: 'Ficheiro', hint: 'O filme em si.' },
  { title: 'Direitos', hint: 'A declaração deste envio.' },
  { title: 'Acesso', hint: 'Quem pode ver e o que credita o estúdio.' },
  { title: 'Revisão', hint: 'Confira antes de enviar.' },
];

const GENRES = ['Drama', 'Comédia', 'Documentário', 'Acção', 'Romance', 'Thriller', 'Cinema angolano'];
const AGES = [
  ['Todos', 'Todos'],
  ['7', '7'],
  ['12', '12'],
  ['16', '16'],
  ['18', '18'],
];
const RENTAL = ['500', '1500', '3000', '5000'];

const MONETIZATION = [
  {
    id: 'avod',
    label: 'Grátis com anúncios',
    body: 'Qualquer pessoa vê. O estúdio recebe por visualização válida e pela parte dos anúncios.',
  },
  {
    id: 'svod',
    label: 'Premium',
    body: 'Só assinantes. A assinatura fica na MinhaTela e não entra neste livro.',
  },
  {
    id: 'tvod',
    label: 'Aluguer',
    body: 'O espectador paga o preço que definir. Esse valor fica na MinhaTela e não entra neste livro.',
  },
];

export default function FilmWizard({ form, setForm, step, setStep, busy, onCreateSlot, onSaveDraft, onSubmit, formError }) {
  const [localError, setLocalError] = useState('');
  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const knownGenre = GENRES.includes(form.genre);
  const message = localError || formError;

  function goNext() {
    if (step === 0) {
      if (!String(form.title || '').trim()) {
        setLocalError('Indique o título do filme.');
        return;
      }
      if (!String(form.synopsisShort || '').trim()) {
        setLocalError('Escreva a sinopse curta.');
        return;
      }
      const poster = normalizePublicWebUrl(form.posterUrl);
      if (!poster.ok || !poster.url) {
        setLocalError('Indique a ligação do cartaz, por exemplo estudio.ao/cartaz.jpg');
        return;
      }
      patch('posterUrl', poster.url);
    }
    if (step === 2 && !form.rightsConfirmed) {
      setLocalError('Confirme os direitos para continuar.');
      return;
    }
    if (step === 3 && form.monetization === 'tvod' && !(Number(form.rentalPriceKz) > 0)) {
      setLocalError('Indique o preço do aluguer.');
      return;
    }
    setLocalError('');
    setStep((current) => Math.min(4, current + 1));
  }

  return (
    <View style={cardSurface({ padding: 20 })}>
      <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800' }}>
        FILME · {step + 1} DE {STEPS.length} · {STEPS[step].title}
      </Text>
      <Text style={{ color: colors.muted, marginTop: 6, marginBottom: 16, lineHeight: 20 }}>{STEPS[step].hint}</Text>

      {step === 0 ? (
        <>
          <FieldLabel>Título</FieldLabel>
          <TextInput
            value={form.title}
            onChangeText={(value) => patch('title', value)}
            style={fieldSurface()}
            placeholder="Título do filme"
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Sinopse curta</FieldLabel>
          <TextInput
            value={form.synopsisShort}
            onChangeText={(value) => patch('synopsisShort', value)}
            style={[fieldSurface(), { minHeight: 72 }]}
            multiline
            placeholder="Uma ou duas frases, como no cartaz"
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Descrição</FieldLabel>
          <TextInput
            value={form.synopsisFull}
            onChangeText={(value) => patch('synopsisFull', value)}
            style={[fieldSurface(), { minHeight: 88 }]}
            multiline
            placeholder="Opcional. A história, sem revelar o fim"
            placeholderTextColor={colors.muted}
          />
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>Género</Text>
          <ChipRow
            options={GENRES.map((genre) => [genre, genre])}
            selected={knownGenre ? form.genre : 'Outro'}
            onSelect={(value) => patch('genre', value === 'Outro' ? '' : value)}
            extra={['Outro', 'Outro']}
          />
          {!knownGenre ? (
            <TextInput
              value={form.genre}
              onChangeText={(value) => patch('genre', value)}
              style={fieldSurface()}
              placeholder="Escreva o género"
              placeholderTextColor={colors.muted}
            />
          ) : null}
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>Classificação</Text>
          <ChipRow options={AGES} selected={form.ageRating} onSelect={(value) => patch('ageRating', value)} />
          <FieldLabel>Ano</FieldLabel>
          <TextInput
            value={form.releaseYear}
            onChangeText={(value) => patch('releaseYear', value.replace(/[^\d]/g, '').slice(0, 4))}
            keyboardType="numeric"
            style={fieldSurface()}
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Duração (minutos)</FieldLabel>
          <TextInput
            value={form.durationMinutes}
            onChangeText={(value) => patch('durationMinutes', value.replace(/[^\d]/g, '').slice(0, 3))}
            keyboardType="numeric"
            style={fieldSurface()}
            placeholder="Opcional. Ex.: 96"
            placeholderTextColor={colors.muted}
          />
          <FieldLabel>Cartaz</FieldLabel>
          <Text style={{ color: colors.muted, marginBottom: 8, lineHeight: 20 }}>
            Imagem vertical. Pode colar o endereço como está no browser.
          </Text>
          <View style={[fieldSurface(), { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
            <Text style={{ color: colors.muted, fontWeight: '800' }}>https://</Text>
            <TextInput
              value={destinationFieldText(form.posterUrl)}
              onChangeText={(value) => patch('posterUrl', value.replace(/^https?:\/\//i, ''))}
              onBlur={() => {
                const next = normalizePublicWebUrl(form.posterUrl);
                if (next.ok && next.url) patch('posterUrl', next.url);
              }}
              style={{ flex: 1, color: colors.text, paddingVertical: 12, paddingLeft: 6 }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="estudio.ao/cartaz.jpg"
              placeholderTextColor={colors.muted}
            />
          </View>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={helpStyle()}>
            {form.bunnyVideoId
              ? 'O ficheiro está associado a este título. Se precisar de o substituir, abra o envio outra vez na Bunny e volte aqui.'
              : 'O filme não se cola neste ecrã. Toque em «Enviar o filme»: abre a Bunny Stream. Aí escolhe o ficheiro no computador (MP4, MKV, etc.). Quando o envio acabar, volte a este passo e continue.'}
          </Text>
          <PrimaryButton
            label={form.bunnyVideoId ? 'Abrir o envio outra vez' : 'Enviar o filme'}
            loading={busy}
            onPress={onCreateSlot}
          />
          <Text style={{ color: form.bunnyVideoId ? colors.gold : colors.muted, marginTop: 12, fontWeight: '700' }}>
            {form.bunnyVideoId ? 'Ficheiro associado' : 'Ainda sem ficheiro'}
          </Text>
          {!form.bunnyVideoId ? (
            <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 20 }}>
              Se o browser bloquear a janela, permita pop-ups para minhatela.vercel.app.
            </Text>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={helpStyle()}>
            A MinhaTela distribui em Angola. A confirmação fica registada com data. Não substitui um contrato de direitos. Uma reclamação pode retirar o título do catálogo.
          </Text>
          <Pressable onPress={() => patch('rightsConfirmed', !form.rightsConfirmed)} style={choice(form.rightsConfirmed)}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              {form.rightsConfirmed ? 'Declaração confirmada' : 'Confirmar direitos'}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>
              Controlo os direitos necessários e autorizo a distribuição deste filme na MinhaTela.
            </Text>
          </Pressable>
        </>
      ) : null}

      {step === 3 ? (
        <>
          {MONETIZATION.map((opt) => (
            <Pressable key={opt.id} onPress={() => patch('monetization', opt.id)} style={choice(form.monetization === opt.id)}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{opt.label}</Text>
              <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 20 }}>{opt.body}</Text>
            </Pressable>
          ))}
          {form.monetization === 'tvod' ? (
            <>
              <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>Preço do aluguer</Text>
              <ChipRow
                options={RENTAL.map((price) => [price, `${Number(price).toLocaleString('pt-AO')} Kz`])}
                selected={form.rentalPriceKz}
                onSelect={(value) => patch('rentalPriceKz', value)}
              />
              <TextInput
                value={form.rentalPriceKz}
                onChangeText={(value) => patch('rentalPriceKz', value.replace(/[^\d]/g, ''))}
                keyboardType="numeric"
                style={fieldSurface()}
                placeholder="Outro valor em Kz"
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
          <Summary label="Género" value={form.genre} />
          <Summary label="Classificação" value={form.ageRating === 'Todos' ? 'Todos' : `${form.ageRating}+`} />
          <Summary label="Ano" value={form.releaseYear} />
          <Summary label="Duração" value={form.durationMinutes ? `${form.durationMinutes} min` : ''} />
          <Summary label="Cartaz" value={form.posterUrl ? 'Ligação indicada' : ''} />
          <Summary label="Ficheiro" value={form.bunnyVideoId ? 'Associado' : 'Em falta'} />
          <Summary label="Direitos" value={form.rightsConfirmed ? 'Declaração confirmada' : 'Em falta'} />
          <Summary label="Acesso" value={MONETIZATION.find((item) => item.id === form.monetization)?.label} />
          {form.monetization === 'tvod' ? <Summary label="Aluguer" value={form.rentalPriceKz ? `${Number(form.rentalPriceKz).toLocaleString('pt-AO')} Kz` : ''} /> : null}
          {!form.bunnyVideoId ? (
            <Text style={{ color: colors.red, marginTop: 12, lineHeight: 20 }}>Falta o ficheiro do filme.</Text>
          ) : null}
          {!form.rightsConfirmed ? (
            <Text style={{ color: colors.red, marginTop: 8, lineHeight: 20 }}>Falta a declaração de direitos.</Text>
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

      {message ? <Text style={{ color: colors.red, marginTop: 12, lineHeight: 20 }}>{message}</Text> : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, gap: 10 }}>
        <PrimaryButton
          label="Anterior"
          variant="outline"
          disabled={step === 0}
          onPress={() => {
            setLocalError('');
            setStep((current) => Math.max(0, current - 1));
          }}
          style={{ flexGrow: 1 }}
        />
        {step < 4 ? <PrimaryButton label="Continuar" onPress={goNext} style={{ flexGrow: 1 }} /> : null}
      </View>
    </View>
  );
}

function ChipRow({ options, selected, onSelect, extra }) {
  const items = extra ? [...options, extra] : options;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {items.map(([value, label]) => {
        const active = selected === value;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            style={{
              borderWidth: active ? 2 : 1,
              borderColor: active ? colors.gold : colors.border,
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
  );
}

function choice(active) {
  return {
    borderWidth: active ? 2 : 1,
    borderColor: active ? colors.gold : colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.surface,
  };
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
