import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, FieldLabel } from '../components/ui';
import { colors, brand, layout } from '../theme/tokens';
import { login, register, applyAuthSession } from '../services/auth';
import { oauthLogin, buildDemoOAuthToken } from '../services/phase25';
import { getDeviceIdentity } from '../platform/deviceIdentity';

export default function Login({ onSuccess, onForgotPassword, onOpenLegal }) {
  const { width, height } = useWindowDimensions();
  const isCompact = width < 768;
  const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const cardWidth = useMemo(
    () => Math.min(440, isCompact ? width - 32 : 440),
    [isCompact, width]
  );

  async function handleOAuth(provider) {
    setError('');
    const mail = (email || '').trim().toLowerCase();
    if (!mail || !mail.includes('@')) {
      setError(`Introduza o email e toque em ${provider === 'google' ? 'Google' : 'Apple'}.`);
      return;
    }
    setLoading(true);
    try {
      const device = await getDeviceIdentity();
      const idToken = buildDemoOAuthToken({
        provider,
        email: mail,
        fullName: fullName || mail.split('@')[0],
      });
      const data = await oauthLogin(provider, {
        idToken,
        email: mail,
        fullName: fullName || mail.split('@')[0],
        deviceName: device.deviceName,
        platform: device.platform,
      });
      await applyAuthSession(data);
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Falha no login social');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        if (!acceptTerms) {
          setError('Aceite os Termos e a Política de Privacidade para continuar');
          setLoading(false);
          return;
        }
        await register({ email, password, fullName, acceptTerms: true });
      }
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Não foi possível autenticar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style="light" />
      <ImageBackground
        source={require('../../assets/angola-flag.jpg')}
        style={{ flex: 1, minHeight: height }}
        imageStyle={{ opacity: 0.18, resizeMode: 'cover' }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)', colors.black]}
          style={{ flex: 1 }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              padding: 16,
            }}
          >
            <View style={{ width: cardWidth, maxWidth: layout.maxContentWidth }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 }}>
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 2,
                    backgroundColor: colors.gold,
                  }}
                />
                <Text
                  style={{
                    color: colors.red,
                    fontSize: 32,
                    fontWeight: '800',
                    letterSpacing: 2,
                  }}
                >
                  {brand.name.toUpperCase()}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: 'rgba(10,10,10,0.92)',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderTopWidth: 3,
                  borderTopColor: colors.red,
                  padding: isCompact ? 22 : 32,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 28,
                    fontWeight: '700',
                    marginBottom: 8,
                  }}
                >
                  {mode === 'login' ? 'Entrar' : 'Criar conta'}
                </Text>
                <Text style={{ color: colors.textSecondary, marginBottom: 24 }}>
                  {brand.tagline}
                </Text>

                {mode === 'register' ? (
                  <View style={{ marginBottom: 16 }}>
                    <FieldLabel>Nome completo</FieldLabel>
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="O seu nome"
                      placeholderTextColor={colors.muted}
                      style={inputStyle}
                    />
                  </View>
                ) : null}

                <View style={{ marginBottom: 16 }}>
                  <FieldLabel>Email</FieldLabel>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="nome@email.com"
                    placeholderTextColor={colors.muted}
                    style={inputStyle}
                  />
                </View>

                <View style={{ marginBottom: 8 }}>
                  <FieldLabel>Palavra-passe</FieldLabel>
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={secure}
                      placeholder="••••••••"
                      placeholderTextColor={colors.muted}
                      style={[inputStyle, { paddingRight: 48 }]}
                    />
                    <Pressable
                      onPress={() => setSecure((v) => !v)}
                      style={{ position: 'absolute', right: 14, top: 14 }}
                    >
                      <Ionicons
                        name={secure ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={colors.muted}
                      />
                    </Pressable>
                  </View>
                </View>

                {error ? (
                  <Text style={{ color: colors.red, marginTop: 12, marginBottom: 4 }}>
                    {error}
                  </Text>
                ) : null}

                {mode === 'login' ? (
                  <Pressable onPress={onForgotPassword} style={{ alignSelf: 'flex-end', marginTop: 10 }}>
                    <Text style={{ color: colors.gold, fontWeight: '600' }}>
                      Esqueceu a palavra-passe?
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setAcceptTerms((v) => !v)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: acceptTerms ? colors.gold : colors.border,
                        backgroundColor: acceptTerms ? colors.gold : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 2,
                      }}
                    >
                      {acceptTerms ? (
                        <Ionicons name="checkmark" size={16} color={colors.black} />
                      ) : null}
                    </View>
                    <Text style={{ color: colors.textSecondary, flex: 1, fontSize: 13, lineHeight: 20 }}>
                      Li e aceito os{' '}
                      <Text
                        style={{ color: colors.gold, fontWeight: '700' }}
                        onPress={() => onOpenLegal?.('terms')}
                      >
                        Termos de Utilização
                      </Text>{' '}
                      e a{' '}
                      <Text
                        style={{ color: colors.gold, fontWeight: '700' }}
                        onPress={() => onOpenLegal?.('privacy')}
                      >
                        Política de Privacidade
                      </Text>
                      .
                    </Text>
                  </Pressable>
                )}

                <PrimaryButton
                  label={mode === 'login' ? 'Entrar' : 'Registar'}
                  onPress={handleSubmit}
                  loading={loading}
                  style={{ marginTop: 20 }}
                />

                <View style={{ marginTop: 22, gap: 12 }}>
                  <Text
                    style={{
                      color: colors.muted,
                      textAlign: 'center',
                      fontSize: 12,
                      letterSpacing: 1,
                    }}
                  >
                    OU CONTINUAR COM
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <PrimaryButton
                      label="Google"
                      variant="outline"
                      onPress={() => handleOAuth('google')}
                      disabled={loading}
                      style={{ flex: 1 }}
                    />
                    <PrimaryButton
                      label="Apple"
                      variant="outline"
                      onPress={() => handleOAuth('apple')}
                      disabled={loading}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    setError('');
                    setMode((m) => (m === 'login' ? 'register' : 'login'));
                  }}
                  style={{ marginTop: 24 }}
                >
                  <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                    {mode === 'login'
                      ? 'Novo na MinhaTela? '
                      : 'Já tem conta? '}
                    <Text style={{ color: colors.gold, fontWeight: '700' }}>
                      {mode === 'login' ? 'Registe-se agora' : 'Entrar'}
                    </Text>
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const inputStyle = {
  backgroundColor: colors.elevated,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 4,
  color: colors.text,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 15,
};
