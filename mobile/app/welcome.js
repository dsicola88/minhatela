import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  useWindowDimensions,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../src/components/ui';
import { colors, brand, layout } from '../src/theme/tokens';
import { fetchPublicAppConfig, createLead } from '../src/services/admin';
import Focusable from '../src/tv/Focusable';

export default function WelcomeLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [landing, setLanding] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchPublicAppConfig();
      setLanding(data?.config?.landing || null);
    } catch {
      setLanding({
        heroTitle: 'Cinema angolano. A tua tela.',
        heroSubtitle: 'Filmes, séries e estreias — IBAN e Multicaixa.',
        heroCtaPrimary: 'Começar grátis',
        heroCtaSecondary: 'Ver planos',
        showLeadForm: true,
        sections: [],
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitLead() {
    setMsg('');
    setBusy(true);
    try {
      await createLead({
        email,
        fullName: name,
        phone,
        source: 'landing',
        interest: 'premium',
      });
      setMsg('Recebemos o teu contacto. A equipa MinhaTela responde em breve.');
      setEmail('');
      setName('');
      setPhone('');
    } catch (err) {
      setMsg(err.message || 'Falha ao enviar');
    } finally {
      setBusy(false);
    }
  }

  const heroTitle = landing?.heroTitle || 'MinhaTela';
  const heroSubtitle = landing?.heroSubtitle || '';
  const sections = landing?.sections || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <ImageBackground
          source={
            landing?.heroImageUrl
              ? { uri: landing.heroImageUrl }
              : undefined
          }
          style={{
            minHeight: isCompact ? 520 : 640,
            justifyContent: 'flex-end',
            backgroundColor: '#0A0A0A',
          }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)', colors.black]}
            style={{
              paddingTop: insets.top + 24,
              paddingHorizontal: isCompact ? 20 : 48,
              paddingBottom: 40,
              maxWidth: layout.maxContentWidth,
              width: '100%',
              alignSelf: 'center',
            }}
          >
            <Text
              style={{
                color: colors.red,
                fontWeight: '800',
                letterSpacing: 2,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {brand.name.toUpperCase()} · ANGOLA
            </Text>
            <Text
              style={{
                color: colors.text,
                fontSize: isCompact ? 36 : 56,
                fontWeight: '900',
                lineHeight: isCompact ? 42 : 64,
                maxWidth: 720,
              }}
            >
              {heroTitle}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 17,
                marginTop: 14,
                maxWidth: 520,
                lineHeight: 26,
              }}
            >
              {heroSubtitle}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              <PrimaryButton
                label={landing?.heroCtaPrimary || 'Começar'}
                onPress={() => router.push('/login')}
              />
              <PrimaryButton
                label={landing?.heroCtaSecondary || 'Planos'}
                variant="outline"
                onPress={() => router.push('/plans')}
              />
            </View>
          </LinearGradient>
        </ImageBackground>

        <View
          style={{
            paddingHorizontal: isCompact ? 20 : 48,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            marginTop: 24,
          }}
        >
          {sections.map((s) => (
            <View key={s.id || s.title} style={{ marginBottom: 28 }}>
              <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 13, letterSpacing: 1 }}>
                {(s.id || 'MORE').toUpperCase()}
              </Text>
              <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 8 }}>
                {s.title}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 16, lineHeight: 24 }}>
                {s.body}
              </Text>
            </View>
          ))}

          {landing?.showLeadForm !== false ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 20,
                backgroundColor: '#111',
                marginTop: 12,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
                {landing?.leadHeadline || 'Deixa o teu contacto'}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6, marginBottom: 16 }}>
                Premium, creators ou publicidade — respondemos por email/WhatsApp.
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nome"
                placeholderTextColor={colors.muted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 10,
                }}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 10,
                }}
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="WhatsApp (+244…)"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 14,
                }}
              />
              <PrimaryButton
                label={busy ? 'A enviar…' : 'Quero ser contactado'}
                onPress={submitLead}
                disabled={busy}
              />
              {msg ? (
                <Text style={{ color: colors.gold, marginTop: 12 }}>{msg}</Text>
              ) : null}
            </View>
          ) : null}

          <Focusable id="welcome-login" onPress={() => router.push('/login')} style={{ marginTop: 28 }}>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              Já tens conta? <Text style={{ color: colors.text, fontWeight: '700' }}>Entrar</Text>
            </Text>
          </Focusable>
        </View>
      </ScrollView>
    </View>
  );
}
