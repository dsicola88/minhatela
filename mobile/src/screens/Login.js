import { useEffect, useMemo, useState } from 'react';
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
import { PrimaryButton, FieldLabel, GoogleSignInButton } from '../components/ui';
import TotpQr from '../components/TotpQr';
import { darkTheme as cinema, layout } from '../theme/tokens';
import { useBrandCopy } from '../context/AppConfigContext';
import {
  login,
  register,
  applyAuthSession,
  mfaSetup,
  mfaSetupConfirm,
  mfaVerifyLogin,
} from '../services/auth';
import { oauthLogin, preloadGoogleIdentity, requestGoogleAccessToken } from '../services/phase25';
import Constants from 'expo-constants';
import { getDeviceIdentity } from '../platform/deviceIdentity';

export default function Login({ onSuccess, onForgotPassword, onOpenLegal }) {
  const { width, height } = useWindowDimensions();
  const isCompact = width < 768;
  const branding = useBrandCopy();
  const googleClientId = Constants.expoConfig?.extra?.googleClientId;

  useEffect(() => {
    preloadGoogleIdentity();
  }, []);

  const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [mfaTicket, setMfaTicket] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaOtpauth, setMfaOtpauth] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaStep, setMfaStep] = useState('');

  const cardWidth = useMemo(
    () => Math.min(440, isCompact ? width - 32 : 440),
    [isCompact, width]
  );

  async function handleOAuth(provider) {
    setError('');
    if (provider === 'apple') {
      setError('Login Apple ainda não está configurado. Use email ou Google.');
      return;
    }
    if (Platform.OS !== 'web') {
      setError('Login Google neste momento funciona no site. Na app use email e palavra-passe.');
      return;
    }
    setLoading(true);
    try {
      if (!googleClientId) {
        throw new Error('Login Google ainda não está configurado neste ambiente.');
      }
      const accessToken = await requestGoogleAccessToken(googleClientId);
      const device = await getDeviceIdentity();
      const data = await oauthLogin('google', {
        accessToken,
        deviceName: device.deviceName,
        platform: device.platform,
      });
      if (data?.mfaRequired || data?.mfaSetupRequired) {
        setError('Esta conta de staff precisa de MFA. Entre com email e palavra-passe.');
        return;
      }
      await applyAuthSession(data);
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Falha no login Google');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        if (mfaStep === 'code') {
          await mfaVerifyLogin(mfaTicket, mfaCode);
          onSuccess?.();
          return;
        }
        if (mfaStep === 'setup') {
          await mfaSetupConfirm(mfaTicket, mfaCode);
          const again = await login({ email, password });
          if (again.mfaRequired) {
            setMfaTicket(again.mfaTicket);
            setMfaStep('code');
            setMfaCode('');
            setError('MFA activo. Introduza o código da app autenticadora.');
            return;
          }
          onSuccess?.();
          return;
        }
        const data = await login({ email, password });
        if (data.mfaSetupRequired) {
          const setup = await mfaSetup(data.mfaTicket);
          setMfaTicket(data.mfaTicket);
          setMfaSecret(setup.secret || '');
          setMfaOtpauth(setup.otpauthUrl || '');
          setMfaStep('setup');
          setError('');
          return;
        }
        if (data.mfaRequired) {
          setMfaTicket(data.mfaTicket);
          setMfaStep('code');
          setError('');
          return;
        }
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
    <View style={{ flex: 1, backgroundColor: cinema.black }}>
      <StatusBar style="light" />
      <ImageBackground
        source={require('../../assets/angola-flag.jpg')}
        style={{ flex: 1, minHeight: height }}
        imageStyle={{ opacity: 0.18, resizeMode: 'cover' }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)', cinema.black]}
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
                    backgroundColor: cinema.gold,
                  }}
                />
                <Text
                  style={{
                    color: cinema.red,
                    fontSize: 32,
                    fontWeight: '800',
                    letterSpacing: 2,
                  }}
                >
                  {(branding.appName || 'MinhaTela').toUpperCase()}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: 'rgba(10,10,10,0.92)',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: cinema.border,
                  borderTopWidth: 3,
                  borderTopColor: cinema.red,
                  padding: isCompact ? 22 : 32,
                }}
              >
                <Text
                  style={{
                    color: cinema.text,
                    fontSize: 28,
                    fontWeight: '700',
                    marginBottom: 8,
                  }}
                >
                  {mode === 'login' ? 'Entrar' : 'Criar conta'}
                </Text>
                <Text style={{ color: cinema.textSecondary, marginBottom: 24 }}>
                  {branding.tagline}
                </Text>

                {mode === 'register' ? (
                  <View style={{ marginBottom: 16 }}>
                    <FieldLabel palette={cinema}>Nome completo</FieldLabel>
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="O seu nome"
                      placeholderTextColor={cinema.muted}
                      style={inputStyle}
                    />
                  </View>
                ) : null}

                <View style={{ marginBottom: 16 }}>
                    <FieldLabel palette={cinema}>Email</FieldLabel>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="nome@email.com"
                    placeholderTextColor={cinema.muted}
                    style={inputStyle}
                  />
                </View>

                <View style={{ marginBottom: 8 }}>
                    <FieldLabel palette={cinema}>Palavra-passe</FieldLabel>
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={secure}
                      placeholder="••••••••"
                      placeholderTextColor={cinema.muted}
                      style={[inputStyle, { paddingRight: 48 }]}
                    />
                    <Pressable
                      onPress={() => setSecure((v) => !v)}
                      style={{ position: 'absolute', right: 14, top: 14 }}
                    >
                      <Ionicons
                        name={secure ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={cinema.muted}
                      />
                    </Pressable>
                  </View>
                </View>

                {mfaStep === 'setup' && (mfaOtpauth || mfaSecret) ? (
                  <TotpQr otpauthUrl={mfaOtpauth} secret={mfaSecret} />
                ) : null}

                {mfaStep ? (
                  <View style={{ marginBottom: 8, marginTop: 12 }}>
                    <FieldLabel palette={cinema}>Código de 6 dígitos</FieldLabel>
                    {mfaStep === 'code' ? (
                      <Text style={{ color: cinema.textSecondary, fontSize: 13, marginBottom: 8 }}>
                        Abra o Google Authenticator e escreva o número que lá aparece.
                      </Text>
                    ) : null}
                    <TextInput
                      value={mfaCode}
                      onChangeText={(value) => setMfaCode(value.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      placeholder="000000"
                      placeholderTextColor={cinema.muted}
                      style={inputStyle}
                      maxLength={6}
                    />
                  </View>
                ) : null}

                {error ? (
                  <Text style={{ color: cinema.red, marginTop: 12, marginBottom: 4 }}>
                    {error}
                  </Text>
                ) : null}

                {mode === 'login' ? (
                  <Pressable onPress={onForgotPassword} style={{ alignSelf: 'flex-end', marginTop: 10 }}>
                    <Text style={{ color: cinema.gold, fontWeight: '600' }}>
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
                        borderColor: acceptTerms ? cinema.gold : cinema.border,
                        backgroundColor: acceptTerms ? cinema.gold : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 2,
                      }}
                    >
                      {acceptTerms ? (
                        <Ionicons name="checkmark" size={16} color={cinema.black} />
                      ) : null}
                    </View>
                    <Text style={{ color: cinema.textSecondary, flex: 1, fontSize: 13, lineHeight: 20 }}>
                      Li e aceito os{' '}
                      <Text
                        style={{ color: cinema.gold, fontWeight: '700' }}
                        onPress={() => onOpenLegal?.('terms')}
                      >
                        Termos de Utilização
                      </Text>{' '}
                      e a{' '}
                      <Text
                        style={{ color: cinema.gold, fontWeight: '700' }}
                        onPress={() => onOpenLegal?.('privacy')}
                      >
                        Política de Privacidade
                      </Text>
                      .
                    </Text>
                  </Pressable>
                )}

                <PrimaryButton
                  label={
                    mfaStep === 'setup'
                      ? 'Confirmar MFA'
                      : mfaStep === 'code'
                        ? 'Verificar MFA'
                        : mode === 'login'
                          ? 'Entrar'
                          : 'Registar'
                  }
                  onPress={handleSubmit}
                  loading={loading}
                  palette={cinema}
                  style={{ marginTop: 20 }}
                />

                {googleClientId ? (
                  <View style={{ marginTop: 22, gap: 12 }}>
                    <Text
                      style={{
                        color: cinema.muted,
                        textAlign: 'center',
                        fontSize: 12,
                        letterSpacing: 1,
                      }}
                    >
                      OU CONTINUAR COM
                    </Text>
                    <GoogleSignInButton
                      onPress={() => handleOAuth('google')}
                      loading={loading}
                    />
                  </View>
                ) : null}

                <Pressable
                  onPress={() => {
                    setError('');
                    setMode((m) => (m === 'login' ? 'register' : 'login'));
                  }}
                  style={{ marginTop: 24 }}
                >
                  <Text style={{ color: cinema.textSecondary, textAlign: 'center' }}>
                    {mode === 'login'
                      ? 'Novo na MinhaTela? '
                      : 'Já tem conta? '}
                    <Text style={{ color: cinema.gold, fontWeight: '700' }}>
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
  backgroundColor: cinema.elevated,
  borderWidth: 1,
  borderColor: cinema.border,
  borderRadius: 4,
  color: cinema.text,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 15,
};
