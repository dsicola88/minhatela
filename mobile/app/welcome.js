import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../src/components/ui';
import { colors, layout } from '../src/theme/tokens';
import { createLead } from '../src/services/admin';
import { useAppConfig } from '../src/context/AppConfigContext';
import Focusable from '../src/tv/Focusable';

export default function WelcomeLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const { landing: cfgLanding, branding } = useAppConfig();
  const landing = cfgLanding?.heroTitle
    ? cfgLanding
    : {
        heroTitle: 'Cinema angolano. A tua tela.',
        heroSubtitle: 'Filmes, séries e estreias — IBAN e Multicaixa.',
        heroCtaPrimary: 'Começar grátis',
        heroCtaSecondary: 'Ver planos',
        showLeadForm: true,
        sections: [],
      };
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

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
  const sectionLabel = {
    avod: 'Grátis',
    premium: 'Premium',
    pay: 'Pagamento',
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <View
          style={{
            paddingTop: insets.top + 16,
            paddingHorizontal: isCompact ? 20 : 48,
            paddingBottom: 8,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1.4, fontSize: 18 }}>
            {(branding.appName || 'MinhaTela').toUpperCase()}
          </Text>
          <Focusable id="welcome-login-top" onPress={() => router.push('/login')}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Entrar</Text>
          </Focusable>
        </View>
        <View
          style={{
            paddingHorizontal: isCompact ? 20 : 48,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            marginTop: 8,
            flexDirection: isCompact ? 'column' : 'row',
            gap: isCompact ? 28 : 48,
            alignItems: 'stretch',
          }}
        >
          <View style={{ flex: 1.15, justifyContent: 'center', paddingVertical: isCompact ? 8 : 36 }}>
            <Text
              style={{
                color: colors.text,
                fontSize: isCompact ? 34 : 52,
                fontWeight: '900',
                lineHeight: isCompact ? 40 : 58,
              }}
            >
              {heroTitle}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 16,
                marginTop: 12,
                lineHeight: 24,
                maxWidth: 520,
              }}
            >
              {heroSubtitle}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, maxWidth: 440 }}>
              <PrimaryButton
                label={landing?.heroCtaPrimary || 'Começar'}
                onPress={() => router.push('/login')}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label={landing?.heroCtaSecondary || 'Planos'}
                variant="outline"
                onPress={() => router.push('/plans')}
                style={{ flex: 1 }}
              />
            </View>
          </View>

          <View style={{ flex: 1, gap: 12, justifyContent: 'center' }}>
            {sections.map((s, index) => (
              <View
                key={s.id || s.title}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: 16,
                  backgroundColor: '#111',
                }}
              >
                <Text style={{ color: colors.gold, fontWeight: '700', fontSize: 12 }}>
                  {sectionLabel[s.id] || `0${index + 1}`}
                </Text>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 }}>
                  {s.title}
                </Text>
                <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 14, lineHeight: 20 }}>
                  {s.body}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: isCompact ? 20 : 48,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            marginTop: 28,
          }}
        >

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
              <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 12, letterSpacing: 1.2 }}>
                CONTACTO
              </Text>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 8 }}>
                Fale connosco
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6, marginBottom: 16 }}>
                Premium, criadores ou publicidade. Respondemos por email ou WhatsApp.
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
              Já tem conta? <Text style={{ color: colors.text, fontWeight: '700' }}>Entrar</Text>
            </Text>
          </Focusable>
        </View>
      </ScrollView>
    </View>
  );
}
