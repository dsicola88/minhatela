import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  Platform,
  Switch,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import { useI18n } from '../i18n';
import { getAccount, revokeDevice, updateProfile } from '../services/account';
import { trustDevice } from '../services/phase24';
import {
  listAuthSessions,
  revokeAuthSession,
  revokeOtherSessions,
} from '../services/auth';
import { redeemPromo, changePassword } from '../services/engagement';
import { resendVerification } from '../services/plans';
import {
  exportMyData,
  requestAccountDeletion,
  cancelAccountDeletion,
} from '../services/legal';
import { getMyReferral, redeemReferral } from '../services/support';
import {
  getHousehold,
  createHousehold,
  inviteHousehold,
  acceptHousehold,
  removeHouseholdMember,
  leaveHousehold,
} from '../services/gifts';
import { getDataSaver, setDataSaver } from '../platform/preferences';
import Focusable from '../tv/Focusable';

function Row({ label, value, danger, onPress, icon, badge }) {
  return (
    <Focusable
      id={`account-${label}`}
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: onPress ? 1 : 0.95,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        {icon ? <Ionicons name={icon} size={20} color={danger ? colors.red : colors.gold} /> : null}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
              {label}
            </Text>
            {badge ? (
              <Text
                style={{
                  color: colors.black,
                  backgroundColor: colors.gold,
                  fontSize: 9,
                  fontWeight: '800',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 2,
                  overflow: 'hidden',
                  marginBottom: 4,
                }}
              >
                {badge}
              </Text>
            ) : null}
          </View>
          <Text style={{ color: danger ? colors.red : colors.text, fontSize: 15, fontWeight: '600' }}>
            {value}
          </Text>
        </View>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </Focusable>
  );
}

export default function Account({
  onBack,
  onSwitchProfiles,
  onManageProfiles,
  onLogout,
  onHistory,
  onPayments,
  onNotifications,
  onMyList,
  onDownloads,
  onPlans,
  onLegal,
  onHelp,
  onGifts,
  onPremieres,
  onForYou,
  onNetwork,
  onLanguages,
  onInvoices,
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [account, setAccount] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [dataSaver, setDataSaverState] = useState(true);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [pwdForm, setPwdForm] = useState({ current: '', next: '' });
  const [pwdMsg, setPwdMsg] = useState('');
  const [privacyMsg, setPrivacyMsg] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [referral, setReferral] = useState(null);
  const [refCode, setRefCode] = useState('');
  const [refMsg, setRefMsg] = useState('');
  const [household, setHousehold] = useState(null);
  const [hhEmail, setHhEmail] = useState('');
  const [hhCode, setHhCode] = useState('');
  const [hhMsg, setHhMsg] = useState('');
  const isCompact = width < 768;

  const load = useCallback(async () => {
    try {
      setError('');
      const [data, saver, sessionData, refData, hhData] = await Promise.all([
        getAccount(),
        getDataSaver(),
        listAuthSessions().catch(() => ({ sessions: [] })),
        getMyReferral().catch(() => null),
        getHousehold().catch(() => null),
      ]);
      setAccount(data);
      setDataSaverState(saver);
      setSessions(sessionData.sessions || []);
      setReferral(refData);
      setHousehold(hhData);
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmAction(title, message) {
    if (Platform.OS === 'web') {
      return window.confirm(message);
    }
    return new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
  }

  async function handleRevoke(device) {
    const ok = await confirmAction(
      'Remover dispositivo',
      `Terminar sessão em «${device.name}»?`
    );
    if (!ok) return;
    try {
      await revokeDevice(device.id);
      await load();
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    }
  }

  async function handleRevokeSession(session) {
    if (session.current) return;
    const ok = await confirmAction(
      'Terminar sessão',
      `Encerrar sessão em «${session.deviceName}»?`
    );
    if (!ok) return;
    try {
      await revokeAuthSession(session.id);
      await load();
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    }
  }

  async function handleRevokeOthers() {
    const ok = await confirmAction(
      'Terminar outras sessões',
      'Encerrar todas as sessões excepto esta?'
    );
    if (!ok) return;
    try {
      await revokeOtherSessions();
      await load();
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    }
  }

  async function handleRedeemPromo() {
    setPromoMsg('');
    try {
      const res = await redeemPromo(promoCode.trim());
      setPromoMsg(res.message || 'Código resgatado');
      setPromoCode('');
      await load();
    } catch (err) {
      setPromoMsg(err.message || 'Código inválido');
    }
  }

  async function handleChangePassword() {
    setPwdMsg('');
    try {
      const res = await changePassword({
        currentPassword: pwdForm.current,
        newPassword: pwdForm.next,
      });
      setPwdMsg(res.message || 'Palavra-passe actualizada');
      setPwdForm({ current: '', next: '' });
      await load();
    } catch (err) {
      setPwdMsg(err.message || 'Falha ao alterar');
    }
  }

  const effective = account?.user?.effectiveSubscription;
  const subLabel =
    effective?.status === 'premium_active' ||
    account?.user?.subscriptionStatus === 'premium_active'
      ? effective?.source === 'household'
        ? 'Premium via agregado familiar'
        : 'Premium activo'
      : 'Plano gratuito (AVOD)';

  const primaryProfile = account?.profiles?.[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: isCompact ? 16 : 40,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Focusable id="account-back" onPress={onBack} accessibilityLabel={t('back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text
          style={{
            color: colors.text,
            fontSize: 20,
            fontWeight: '700',
            marginLeft: 16,
            flex: 1,
          }}
        >
          Conta
        </Text>
        <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1 }}>
          {brand.name.toUpperCase()}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.red} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: isCompact ? 16 : 40,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            paddingBottom: 80,
          }}
        >
          {error ? (
            <Text style={{ color: colors.red, marginBottom: 16 }}>{error}</Text>
          ) : null}

          <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>
            ASSINATURA
          </Text>
          <Row
            label="Plano"
            value={subLabel}
            icon="diamond-outline"
            onPress={onPlans}
          />
          {!account?.user?.emailVerified ? (
            <Pressable
              onPress={async () => {
                try {
                  const res = await resendVerification();
                  setPromoMsg(res.message || 'Link enviado');
                } catch (err) {
                  setPromoMsg(err.message || 'Falha ao reenviar');
                }
              }}
              style={{
                marginTop: 12,
                marginBottom: 8,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.gold,
                borderRadius: 4,
              }}
            >
              <Text style={{ color: colors.gold, fontWeight: '700' }}>
                Confirmar email — reenviar link
              </Text>
            </Pressable>
          ) : null}
          <Row
            label="Streams simultâneos"
            value={`${account?.streams?.active || 0} / ${account?.streams?.limit || 1}`}
            icon="play-circle-outline"
          />
          <Row label="Email" value={account?.user?.email || '—'} icon="mail-outline" />

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 28,
              marginBottom: 10,
            }}
          >
            CÓDIGO PROMOCIONAL
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <TextInput
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
              placeholder="ANGOLA7"
              placeholderTextColor={colors.muted}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 4,
                letterSpacing: 1,
                fontWeight: '700',
              }}
            />
            <Pressable
              onPress={handleRedeemPromo}
              style={{
                backgroundColor: colors.red,
                paddingHorizontal: 16,
                justifyContent: 'center',
                borderRadius: 4,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>Resgatar</Text>
            </Pressable>
          </View>
          {promoMsg ? (
            <Text style={{ color: colors.gold, fontSize: 12, marginBottom: 8 }}>{promoMsg}</Text>
          ) : null}

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 20,
              marginBottom: 10,
            }}
          >
            SEGURANÇA
          </Text>
          <TextInput
            value={pwdForm.current}
            onChangeText={(current) => setPwdForm((f) => ({ ...f, current }))}
            secureTextEntry
            placeholder="Palavra-passe actual"
            placeholderTextColor={colors.muted}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.text,
              paddingHorizontal: 12,
              paddingVertical: 12,
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <TextInput
            value={pwdForm.next}
            onChangeText={(next) => setPwdForm((f) => ({ ...f, next }))}
            secureTextEntry
            placeholder="Nova palavra-passe (mín. 8)"
            placeholderTextColor={colors.muted}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.text,
              paddingHorizontal: 12,
              paddingVertical: 12,
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <Pressable onPress={handleChangePassword} style={{ marginBottom: 8 }}>
            <Text style={{ color: colors.gold, fontWeight: '700' }}>Alterar palavra-passe</Text>
          </Pressable>
          {pwdMsg ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>{pwdMsg}</Text>
          ) : null}

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 32,
            }}
          >
            REPRODUÇÃO · ANGOLA
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Poupança de dados</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                Arranque em 480p · ideal Unitel/Movicel
              </Text>
            </View>
            <Switch
              value={dataSaver}
              onValueChange={async (value) => {
                setDataSaverState(value);
                await setDataSaver(value);
              }}
              trackColor={{ true: colors.gold, false: colors.border }}
            />
          </View>

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 32,
            }}
          >
            ACESSIBILIDADE
          </Text>
          {[
            {
              key: 'reducedMotion',
              label: 'Reduzir movimento',
              hint: 'Menos animações e pré-visualizações',
            },
            {
              key: 'highContrast',
              label: 'Alto contraste',
              hint: 'Texto e controlos mais nítidos',
            },
            {
              key: 'audioDescription',
              label: 'Audiodescrição',
              hint: 'Preferir pista AD quando disponível',
            },
            {
              key: 'largeText',
              label: 'Texto maior',
              hint: 'Legendas e UI ampliadas',
            },
          ].map((opt) => (
            <View
              key={opt.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{opt.label}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{opt.hint}</Text>
              </View>
              <Switch
                value={Boolean(primaryProfile?.a11y?.[opt.key])}
                onValueChange={async (value) => {
                  if (!primaryProfile?.id) return;
                  try {
                    const a11y = { ...(primaryProfile.a11y || {}), [opt.key]: value };
                    await updateProfile(primaryProfile.id, { a11y });
                    await load();
                  } catch (err) {
                    setError(err.message || 'Falha a11y');
                  }
                }}
                trackColor={{ true: colors.gold, false: colors.border }}
              />
            </View>
          ))}

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 32,
            }}
          >
            QUALIDADE · DOWNLOADS · SEGURANÇA
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, marginBottom: 8 }}>
            Qualidade de reprodução preferida
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {['auto', '480p', '720p', '1080p'].map((q) => (
              <Pressable
                key={q}
                onPress={async () => {
                  if (!primaryProfile?.id) return;
                  try {
                    await updateProfile(primaryProfile.id, { preferredQuality: q });
                    await load();
                  } catch (err) {
                    setError(err.message || 'Falha qualidade');
                  }
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor:
                    (primaryProfile?.preferredQuality || 'auto') === q
                      ? colors.gold
                      : colors.border,
                  backgroundColor:
                    (primaryProfile?.preferredQuality || 'auto') === q
                      ? 'rgba(247,212,23,0.12)'
                      : 'transparent',
                }}
              >
                <Text
                  style={{
                    color:
                      (primaryProfile?.preferredQuality || 'auto') === q
                        ? colors.gold
                        : colors.text,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  {q === 'auto' ? 'Auto' : q}
                </Text>
              </Pressable>
            ))}
          </View>
          {[
            {
              key: 'wifiOnlyDownloads',
              label: 'Downloads só em Wi‑Fi',
              hint: 'Evita consumo de dados móveis Unitel/Movicel',
            },
            {
              key: 'loginAlerts',
              label: 'Alertas de novo login',
              hint: 'Email + notificação quando um dispositivo novo entrar',
            },
            {
              key: 'hideSpoilers',
              label: 'Anti-spoilers',
              hint: 'Oculta títulos e sinopses de episódios ainda não vistos',
            },
          ].map((opt) => (
            <View
              key={opt.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{opt.label}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{opt.hint}</Text>
              </View>
              <Switch
                value={
                  opt.key === 'hideSpoilers'
                    ? Boolean(primaryProfile?.hideSpoilers)
                    : Boolean(primaryProfile?.[opt.key] !== false)
                }
                onValueChange={async (value) => {
                  if (!primaryProfile?.id) return;
                  try {
                    await updateProfile(primaryProfile.id, { [opt.key]: value });
                    await load();
                  } catch (err) {
                    setError(err.message || 'Falha preferência');
                  }
                }}
                trackColor={{ true: colors.gold, false: colors.border }}
              />
          </View>
          ))}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Countdown autoplay</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                Segundos até o próximo episódio (0 = desligado)
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[0, 5, 10, 15].map((n) => (
                <Pressable
                  key={n}
                  onPress={async () => {
                    if (!primaryProfile?.id) return;
                    try {
                      await updateProfile(primaryProfile.id, { autoplayCountdownSeconds: n });
                      await load();
                    } catch (err) {
                      setError(err.message || 'Falha');
                    }
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor:
                      Number(primaryProfile?.autoplayCountdownSeconds ?? 10) === n
                        ? colors.gold
                        : colors.border,
                    backgroundColor:
                      Number(primaryProfile?.autoplayCountdownSeconds ?? 10) === n
                        ? colors.gold
                        : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color:
                        Number(primaryProfile?.autoplayCountdownSeconds ?? 10) === n
                          ? colors.black
                          : colors.text,
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {n === 0 ? 'Off' : `${n}s`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 32,
            }}
          >
            ACTIVIDADE
          </Text>
          <Row
            label="Para si"
            value="Hub personalizado"
            icon="sparkles-outline"
            onPress={onForYou}
          />
          <Row
            label="Categorias & Idiomas"
            value="PT · EN · nacionais"
            icon="globe-outline"
            onPress={onLanguages}
          />
          <Row
            label="Diagnóstico de rede"
            value="Qualidade recomendada"
            icon="speedometer-outline"
            onPress={onNetwork}
          />
          <Row
            label="Facturas"
            value="Arquivo de pagamentos"
            icon="document-text-outline"
            onPress={onInvoices}
          />
          <Row
            label="Downloads"
            value="Ver offline"
            icon="download-outline"
            onPress={onDownloads}
          />
          {onMyList ? (
            <Row
              label="A Minha Lista"
              value="Títulos guardados"
              icon="bookmark-outline"
              onPress={onMyList}
            />
          ) : null}
          <Row
            label="Notificações"
            value="Pagamentos e alertas"
            icon="notifications-outline"
            onPress={onNotifications}
          />
          <Row
            label="Histórico"
            value="O que assistiu"
            icon="time-outline"
            onPress={onHistory}
          />
          <Row
            label="Os meus pagamentos"
            value="IBAN / Multicaixa"
            icon="card-outline"
            onPress={onPayments}
          />

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 32,
            }}
          >
            PERFIS
          </Text>
          <Row
            label="Trocar de perfil"
            value={`${account?.profiles?.length || 0} perfis`}
            icon="people-outline"
            onPress={onSwitchProfiles}
          />
          <Row
            label="Gerir perfis"
            value="Criar, kids, PIN"
            icon="create-outline"
            onPress={onManageProfiles}
          />

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 32,
              marginBottom: 8,
            }}
          >
            SESSÕES DE ACESSO
          </Text>
          {sessions.length === 0 ? (
            <Text style={{ color: colors.muted, marginBottom: 8 }}>
              Nenhuma sessão activa registada.
            </Text>
          ) : (
            sessions.map((session) => (
              <Row
                key={session.id}
                label={`${session.deviceName} · ${session.platform}`}
                value={
                  session.lastSeenAt
                    ? `Visto ${new Date(session.lastSeenAt).toLocaleString('pt-AO')}`
                    : '—'
                }
                icon="laptop-outline"
                badge={session.current ? 'ESTA' : null}
                danger={!session.current}
                onPress={session.current ? undefined : () => handleRevokeSession(session)}
              />
            ))
          )}
          {sessions.filter((s) => !s.current).length > 0 ? (
            <Pressable onPress={handleRevokeOthers} style={{ paddingVertical: 14 }}>
              <Text style={{ color: colors.gold, fontWeight: '600', fontSize: 13 }}>
                Terminar todas as outras sessões
              </Text>
            </Pressable>
          ) : null}

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 32,
            }}
          >
            AGREGADO · PRESENTES · ESTREIAS
          </Text>
          <Row
            label="Presentes Premium"
            value="Oferecer / resgatar"
            icon="gift-outline"
            onPress={onGifts}
          />
          <Row
            label="Estreias"
            value="Countdown Angola"
            icon="rocket-outline"
            onPress={onPremieres}
          />
          {!household?.household ? (
            <Pressable
              onPress={async () => {
                try {
                  setHhMsg('');
                  const res = await createHousehold();
                  setHousehold(res);
                  setHhMsg('Agregado criado');
                } catch (err) {
                  setHhMsg(err.message || 'Falha ao criar agregado');
                }
              }}
              style={{ paddingVertical: 14 }}
            >
              <Text style={{ color: colors.gold, fontWeight: '700' }}>
                Criar agregado familiar (Premium)
              </Text>
            </Pressable>
          ) : (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
                {household.slotsUsed}/{household.slotsMax} lugares ·{' '}
                {household.isOwner ? 'Titular' : 'Membro'}
              </Text>
              {(household.members || []).map((m) => (
                <View
                  key={m.id || m.userId || m.email}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text, flex: 1 }}>
                    {m.email || 'Convite'} · {m.role} · {m.status}
                    {m.inviteCode ? ` · ${m.inviteCode}` : ''}
                  </Text>
                  {household.isOwner && m.role === 'member' && m.status === 'active' && m.userId ? (
                    <Pressable
                      onPress={async () => {
                        await removeHouseholdMember(m.userId);
                        await load();
                      }}
                    >
                      <Text style={{ color: colors.red, fontWeight: '700' }}>Remover</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {household.canInvite ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TextInput
                    value={hhEmail}
                    onChangeText={setHhEmail}
                    placeholder="Email do membro"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: colors.border,
                      color: colors.text,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 4,
                    }}
                  />
                  <Pressable
                    onPress={async () => {
                      try {
                        const res = await inviteHousehold(hhEmail.trim());
                        setHhMsg(res.shareMessage || 'Convite enviado');
                        setHhEmail('');
                        await load();
                      } catch (err) {
                        setHhMsg(err.message || 'Falha no convite');
                      }
                    }}
                    style={{
                      backgroundColor: colors.red,
                      paddingHorizontal: 14,
                      justifyContent: 'center',
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Convidar</Text>
                  </Pressable>
                </View>
              ) : null}
              {!household.isOwner ? (
                <Pressable
                  onPress={async () => {
                    await leaveHousehold();
                    await load();
                  }}
                  style={{ marginTop: 12 }}
                >
                  <Text style={{ color: colors.red, fontWeight: '700' }}>Sair do agregado</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 8 }}>
            <TextInput
              value={hhCode}
              onChangeText={setHhCode}
              autoCapitalize="characters"
              placeholder="Código de convite"
              placeholderTextColor={colors.muted}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 4,
                fontWeight: '700',
              }}
            />
            <Pressable
              onPress={async () => {
                try {
                  const res = await acceptHousehold(hhCode.trim());
                  setHousehold(res);
                  setHhCode('');
                  setHhMsg('Entrou no agregado');
                } catch (err) {
                  setHhMsg(err.message || 'Convite inválido');
                }
              }}
              style={{
                backgroundColor: colors.gold,
                paddingHorizontal: 16,
                justifyContent: 'center',
                borderRadius: 4,
              }}
            >
              <Text style={{ color: colors.black, fontWeight: '800' }}>Entrar</Text>
            </Pressable>
          </View>
          {hhMsg ? (
            <Text style={{ color: colors.gold, fontSize: 12, marginBottom: 8 }}>{hhMsg}</Text>
          ) : null}

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 32,
            }}
          >
            AJUDA · INDICAÇÕES
          </Text>
          <Row
            label="Centro de Ajuda"
            value="FAQ e tickets"
            icon="help-circle-outline"
            onPress={onHelp}
          />
          {referral ? (
            <View style={{ marginTop: 8, marginBottom: 8 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
                O seu código · {referral.stats?.redeemed || 0} resgates
              </Text>
              <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 22, letterSpacing: 2 }}>
                {referral.code}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                +{referral.rewardDays} dias Premium por amigo
              </Text>
              {Platform.OS === 'web' ? (
                <Pressable
                  onPress={() => {
                    navigator.clipboard?.writeText?.(referral.shareMessage || referral.code);
                    setRefMsg('Copiado');
                  }}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ color: colors.gold, fontWeight: '700' }}>Copiar convite</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <TextInput
              value={refCode}
              onChangeText={setRefCode}
              autoCapitalize="characters"
              placeholder="Código de amigo"
              placeholderTextColor={colors.muted}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 4,
                fontWeight: '700',
              }}
            />
            <Pressable
              onPress={async () => {
                try {
                  const res = await redeemReferral(refCode);
                  setRefMsg(res.message || 'Código aplicado');
                  setRefCode('');
                  await load();
                } catch (err) {
                  setRefMsg(err.message || 'Código inválido');
                }
              }}
              style={{
                backgroundColor: colors.red,
                paddingHorizontal: 16,
                justifyContent: 'center',
                borderRadius: 4,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>Usar</Text>
            </Pressable>
          </View>
          {refMsg ? (
            <Text style={{ color: colors.gold, fontSize: 12, marginBottom: 8 }}>{refMsg}</Text>
          ) : null}

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 32,
              marginBottom: 8,
            }}
          >
            PRIVACIDADE · DADOS
          </Text>
          <Row
            label="Termos de Utilização"
            value="v1.0 · Angola"
            icon="document-text-outline"
            onPress={() => onLegal?.('terms')}
          />
          <Row
            label="Política de Privacidade"
            value="Os seus direitos"
            icon="shield-checkmark-outline"
            onPress={() => onLegal?.('privacy')}
          />
          <Pressable
            onPress={async () => {
              try {
                setPrivacyMsg('A preparar exportação…');
                const res = await exportMyData();
                setPrivacyMsg(
                  res.cached
                    ? 'Exportação recente disponível (válida 7 dias).'
                    : `Dados exportados · ${res.id?.slice?.(0, 8) || 'ok'}`
                );
                if (Platform.OS === 'web' && res.data) {
                  const blob = new Blob([JSON.stringify(res.data, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `minhatela-dados-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              } catch (err) {
                setPrivacyMsg(err.message || 'Falha na exportação');
              }
            }}
            style={{ paddingVertical: 14 }}
          >
            <Text style={{ color: colors.gold, fontWeight: '700' }}>
              Descarregar os meus dados (JSON)
            </Text>
          </Pressable>
          {account?.user?.deletionScheduledAt ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.red, marginBottom: 8 }}>
                Eliminação agendada para{' '}
                {new Date(account.user.deletionScheduledAt).toLocaleString('pt-AO')}
              </Text>
              <Pressable
                onPress={async () => {
                  try {
                    await cancelAccountDeletion();
                    setPrivacyMsg('Eliminação cancelada');
                    await load();
                  } catch (err) {
                    setPrivacyMsg(err.message || 'Falha ao cancelar');
                  }
                }}
              >
                <Text style={{ color: colors.gold, fontWeight: '700' }}>
                  Cancelar eliminação da conta
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginBottom: 8 }}>
              <TextInput
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
                placeholder="Palavra-passe para eliminar conta"
                placeholderTextColor={colors.muted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 4,
                  marginBottom: 8,
                }}
              />
              <Pressable
                onPress={async () => {
                  const ok = await confirmAction(
                    'Eliminar conta',
                    'A conta será eliminada em 30 dias. Escreva ELIMINAR para confirmar na próxima etapa.'
                  );
                  if (!ok) return;
                  const confirmWord =
                    Platform.OS === 'web'
                      ? window.prompt('Escreva ELIMINAR para confirmar')
                      : 'ELIMINAR';
                  if (confirmWord !== 'ELIMINAR') {
                    setPrivacyMsg('Confirmação incorrecta');
                    return;
                  }
                  try {
                    const res = await requestAccountDeletion({
                      password: deletePassword,
                      confirm: 'ELIMINAR',
                    });
                    setPrivacyMsg(res.message || 'Eliminação agendada');
                    setDeletePassword('');
                    await load();
                  } catch (err) {
                    setPrivacyMsg(err.message || 'Falha ao eliminar');
                  }
                }}
              >
                <Text style={{ color: colors.red, fontWeight: '700' }}>
                  Solicitar eliminação da conta (30 dias)
                </Text>
              </Pressable>
            </View>
          )}
          {privacyMsg ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>{privacyMsg}</Text>
          ) : null}

          <Text
            style={{
              color: colors.gold,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 32,
              marginBottom: 8,
            }}
          >
            DISPOSITIVOS DE STREAM
          </Text>
          {(account?.devices || []).length === 0 ? (
            <Text style={{ color: colors.muted }}>Nenhum dispositivo registado ainda.</Text>
          ) : (
            account.devices.map((device) => (
              <View key={device.id} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 12 }}>
                <Row
                  label={`${device.name} · ${device.platform}${device.isTrusted ? ' · CONFIÁVEL' : ''}`}
                  value={
                    device.lastSeenAt
                      ? `Visto ${new Date(device.lastSeenAt).toLocaleString('pt-AO')}`
                      : '—'
                  }
                  icon={device.isTrusted ? 'shield-checkmark-outline' : 'phone-portrait-outline'}
                  badge={device.isTrusted ? 'OK' : null}
                />
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                  <Pressable
                    onPress={async () => {
                      try {
                        await trustDevice(device.id, !device.isTrusted);
                        await load();
                      } catch (err) {
                        setError(err.message || 'Falha');
                      }
                    }}
                  >
                    <Text style={{ color: colors.gold, fontWeight: '700', fontSize: 13 }}>
                      {device.isTrusted ? 'Remover confiança' : 'Marcar confiável'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => handleRevoke(device)}>
                    <Text style={{ color: colors.red, fontWeight: '700', fontSize: 13 }}>Revogar</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              marginTop: 8,
            }}
          >
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>PIN no play</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                Exigir PIN do perfil ao iniciar reprodução
              </Text>
            </View>
            <Switch
              value={Boolean(primaryProfile?.requirePinOnPlay)}
              onValueChange={async (value) => {
                if (!primaryProfile?.id) return;
                try {
                  await updateProfile(primaryProfile.id, { requirePinOnPlay: value });
                  await load();
                } catch (err) {
                  setError(err.message || 'Falha');
                }
              }}
              trackColor={{ true: colors.gold, false: colors.border }}
            />
          </View>

          <Pressable
            onPress={onLogout}
            style={{
              marginTop: 40,
              borderWidth: 1,
              borderColor: colors.red,
              paddingVertical: 14,
              alignItems: 'center',
              borderRadius: 4,
            }}
          >
            <Text style={{ color: colors.red, fontWeight: '700', letterSpacing: 1 }}>
              TERMINAR SESSÃO
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
