import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  TextInput,
  Modal,
  Switch,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { colors, brand, layout } from '../theme/tokens';
import { useI18n } from '../i18n';
import { getProfiles, setActiveProfile } from '../services/auth';
import { selectProfile as markProfileSelected } from '../services/phase26';
import {
  createProfile,
  deleteProfile,
  unlockProfile,
  updateProfile,
} from '../services/account';
import { listAvatars } from '../services/support';
import Focusable from '../tv/Focusable';

const FALLBACK_AVATARS = [
  'https://api.dicebear.com/9.x/shapes/png?seed=angola1&backgroundColor=ce1126',
  'https://api.dicebear.com/9.x/shapes/png?seed=angola2&backgroundColor=f7d417',
  'https://api.dicebear.com/9.x/shapes/png?seed=angola3&backgroundColor=9b0c1c',
  'https://api.dicebear.com/9.x/shapes/png?seed=angola4&backgroundColor=c9a912',
];

function ProfileCard({ profile, index, size, onSelect, manageMode, onEdit }) {
  return (
    <Focusable
      id={`profile-${profile.id}`}
      onPress={() => (manageMode ? onEdit?.(profile) : onSelect?.(profile))}
      accessibilityLabel={profile.name}
      style={{ alignItems: 'center', width: size + 24 }}
    >
      {({ focused }) => (
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: size,
              height: size,
              borderRadius: 8,
              overflow: 'hidden',
              borderWidth: focused ? 3 : 2,
              borderColor: focused ? colors.text : colors.border,
              backgroundColor: colors.elevated,
              ...(Platform.OS === 'web'
                ? { boxShadow: focused ? '0 0 18px rgba(255,255,255,0.35)' : 'none' }
                : {}),
            }}
          >
            <Image
              source={{
                uri: profile.avatarUrl || FALLBACK_AVATARS[index % FALLBACK_AVATARS.length],
              }}
              style={{ width: '100%', height: '100%' }}
            />
            {profile.isKids ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: colors.gold,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    color: colors.black,
                    fontSize: 10,
                    fontWeight: '800',
                    textAlign: 'center',
                  }}
                >
                  KIDS
                </Text>
              </View>
            ) : null}
            {profile.isLastUsed && !manageMode ? (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  backgroundColor: colors.red,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 2,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 9, fontWeight: '800' }}>ÚLTIMO</Text>
              </View>
            ) : null}
            {profile.hasPin ? (
              <View style={{ position: 'absolute', top: 6, right: 6 }}>
                <Ionicons name="lock-closed" size={16} color={colors.text} />
              </View>
            ) : null}
            {manageMode ? (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="pencil" size={28} color={colors.text} />
              </View>
            ) : null}
          </View>
          <Text
            style={{
              color: focused ? colors.text : colors.textSecondary,
              marginTop: 14,
              fontSize: 16,
              fontWeight: '500',
            }}
          >
            {profile.name}
          </Text>
        </View>
      )}
    </Focusable>
  );
}

export default function Profiles({ onSelect, initialManage = false }) {
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [manageMode, setManageMode] = useState(initialManage);
  const [pinTarget, setPinTarget] = useState(null);
  const [pin, setPin] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({
    name: '',
    isKids: false,
    pin: '',
    maturityMax: 18,
    autoplayNext: true,
    autoplayPreviews: true,
    avatarUrl: '',
  });
  const [avatars, setAvatars] = useState([]);
  const size = width < 768 ? 96 : layout.profileSize;

  const load = useCallback(async () => {
    try {
      setError('');
      const [data, avatarData] = await Promise.all([
        getProfiles(),
        listAvatars().catch(() => ({ avatars: [] })),
      ]);
      setProfiles(data.profiles || []);
      setAvatars(avatarData.avatars || []);
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSelect(profile) {
    if (profile.hasPin) {
      setPinTarget(profile);
      setPin('');
      return;
    }
    await setActiveProfile(profile);
    markProfileSelected(profile.id).catch(() => {});
    onSelect?.(profile);
  }

  async function confirmPin() {
    try {
      const unlocked = await unlockProfile(pinTarget.id, pin);
      await setActiveProfile(unlocked);
      markProfileSelected(unlocked.id).catch(() => {});
      setPinTarget(null);
      setPin('');
      onSelect?.(unlocked);
    } catch (err) {
      setError(err.message || 'PIN incorrecto');
    }
  }

  function openCreate() {
    setEditTarget({ id: null });
    setForm({
      name: '',
      isKids: false,
      pin: '',
      maturityMax: 18,
      autoplayNext: true,
      autoplayPreviews: true,
      avatarUrl: '',
    });
  }

  function openEdit(profile) {
    setEditTarget(profile);
    setForm({
      name: profile.name,
      isKids: profile.isKids,
      pin: '',
      maturityMax: profile.maturityMax || (profile.isKids ? 7 : 18),
      autoplayNext: profile.autoplayNext !== false,
      autoplayPreviews: profile.autoplayPreviews !== false,
      avatarUrl: profile.avatarUrl || '',
    });
  }

  async function saveProfile() {
    try {
      if (editTarget?.id) {
        await updateProfile(editTarget.id, {
          name: form.name,
          isKids: form.isKids,
          maturityMax: form.isKids ? Math.min(form.maturityMax || 7, 12) : form.maturityMax || 18,
          autoplayNext: form.autoplayNext,
          autoplayPreviews: form.autoplayPreviews,
          avatarUrl: form.avatarUrl || null,
          ...(form.pin ? { pin: form.pin } : {}),
        });
      } else {
        await createProfile({
          name: form.name,
          isKids: form.isKids,
          maturityMax: form.isKids ? 7 : 18,
          avatarUrl: form.avatarUrl || undefined,
          ...(form.pin ? { pin: form.pin } : {}),
        });
      }
      setEditTarget(null);
      setLoading(true);
      await load();
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    }
  }

  async function removeProfile() {
    if (!editTarget?.id) return;
    try {
      await deleteProfile(editTarget.id);
      setEditTarget(null);
      setLoading(true);
      await load();
    } catch (err) {
      setError(err.message || t('errorGeneric'));
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.black,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <StatusBar style="light" />
      <Text
        style={{
          color: colors.red,
          fontSize: 18,
          fontWeight: '800',
          letterSpacing: 2,
          marginBottom: 18,
        }}
      >
        {brand.name.toUpperCase()}
      </Text>
      <Text
        style={{
          color: colors.text,
          fontSize: width < 768 ? 28 : 46,
          fontWeight: '500',
          marginBottom: 40,
          textAlign: 'center',
        }}
      >
        {manageMode ? 'Gerir perfis' : t('whoIsWatching')}
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.red} size="large" />
      ) : error ? (
        <Text style={{ color: colors.red, marginBottom: 16 }}>{error}</Text>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: width < 768 ? 18 : 28,
            maxWidth: 720,
          }}
        >
          {profiles.map((profile, index) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              index={index}
              size={size}
              manageMode={manageMode}
              onSelect={handleSelect}
              onEdit={openEdit}
            />
          ))}
          {manageMode && profiles.length < 4 ? (
            <Focusable
              id="profile-add"
              onPress={openCreate}
              style={{ alignItems: 'center', width: size + 24 }}
            >
              <View
                style={{
                  width: size,
                  height: size,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="add" size={40} color={colors.muted} />
              </View>
              <Text style={{ color: colors.muted, marginTop: 14, fontSize: 16 }}>Adicionar</Text>
            </Focusable>
          ) : null}
        </View>
      )}

      <Pressable
        onPress={() => setManageMode((v) => !v)}
        style={{
          marginTop: 48,
          borderWidth: 1,
          borderColor: manageMode ? colors.gold : colors.muted,
          paddingHorizontal: 28,
          paddingVertical: 10,
        }}
      >
        <Text
          style={{
            color: manageMode ? colors.gold : colors.muted,
            letterSpacing: 1.2,
            fontWeight: '600',
          }}
        >
          {manageMode ? 'CONCLUÍDO' : 'GERIR PERFIS'}
        </Text>
      </Pressable>

      <Modal visible={Boolean(pinTarget)} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.85)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.elevated,
              padding: 24,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
              PIN — {pinTarget?.name}
            </Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>
              Introduza o PIN de 4 dígitos
            </Text>
            <TextInput
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                padding: 14,
                fontSize: 24,
                letterSpacing: 12,
                textAlign: 'center',
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setPinTarget(null)}
                style={{ flex: 1, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: colors.muted }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={confirmPin}
                style={{
                  flex: 1,
                  padding: 12,
                  alignItems: 'center',
                  backgroundColor: colors.red,
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>Desbloquear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(editTarget)} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.85)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: colors.elevated,
              padding: 24,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
              {editTarget?.id ? 'Editar perfil' : 'Novo perfil'}
            </Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Avatar</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {(avatars.length
                ? avatars.filter((a) => !form.isKids || a.isKids || !a.isKids)
                : FALLBACK_AVATARS.map((url, i) => ({
                    id: `fb-${i}`,
                    imageUrl: url,
                    label: `Avatar ${i + 1}`,
                  }))
              ).map((av) => {
                const url = av.imageUrl || av;
                const selected = form.avatarUrl === url;
                return (
                  <Pressable
                    key={av.id || url}
                    onPress={() => setForm((f) => ({ ...f, avatarUrl: url }))}
                    style={{
                      marginRight: 10,
                      borderWidth: 2,
                      borderColor: selected ? colors.gold : colors.border,
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <Image source={{ uri: url }} style={{ width: 56, height: 56 }} />
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={{ color: colors.textSecondary, marginBottom: 6 }}>Nome</Text>
            <TextInput
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                padding: 12,
                marginBottom: 16,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <Text style={{ color: colors.text }}>Perfil Kids</Text>
              <Switch
                value={form.isKids}
                onValueChange={(isKids) =>
                  setForm((f) => ({ ...f, isKids, maturityMax: isKids ? 7 : 18 }))
                }
                trackColor={{ true: colors.gold, false: colors.border }}
              />
            </View>
            {editTarget?.id ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: colors.text }}>Autoplay episódio seguinte</Text>
                  <Switch
                    value={form.autoplayNext}
                    onValueChange={(autoplayNext) => setForm((f) => ({ ...f, autoplayNext }))}
                    trackColor={{ true: colors.gold, false: colors.border }}
                  />
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ color: colors.text }}>Pré-visualizações autoplay</Text>
                  <Switch
                    value={form.autoplayPreviews}
                    onValueChange={(autoplayPreviews) =>
                      setForm((f) => ({ ...f, autoplayPreviews }))
                    }
                    trackColor={{ true: colors.gold, false: colors.border }}
                  />
                </View>
              </>
            ) : null}
            <Text style={{ color: colors.textSecondary, marginBottom: 6 }}>
              PIN (4 dígitos, opcional)
            </Text>
            <TextInput
              value={form.pin}
              onChangeText={(p) => setForm((f) => ({ ...f, pin: p.replace(/\D/g, '').slice(0, 4) }))}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholder="····"
              placeholderTextColor={colors.muted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                padding: 12,
                marginBottom: 20,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {editTarget?.id ? (
                <Pressable onPress={removeProfile} style={{ padding: 12 }}>
                  <Text style={{ color: colors.red, fontWeight: '600' }}>Eliminar</Text>
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setEditTarget(null)} style={{ padding: 12 }}>
                <Text style={{ color: colors.muted }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={saveProfile}
                style={{
                  backgroundColor: colors.red,
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
