import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import {
  createWatchParty,
  joinWatchParty,
  getWatchPartyState,
  endWatchParty,
  leaveWatchParty,
} from '../services/watchTogether';
import Focusable from '../tv/Focusable';

export default function WatchTogether({
  onBack,
  initialCode,
  contentId,
  sessionId,
  onOpenWatch,
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [code, setCode] = useState(initialCode || '');
  const [name, setName] = useState('Eu');
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async (roomId) => {
    const state = await getWatchPartyState(roomId);
    setRoom(state);
    return state;
  }, []);

  useEffect(() => {
    if (!room?.id || room.status !== 'active') return undefined;
    const timer = setInterval(() => {
      refresh(room.id).catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [room?.id, room?.status, refresh]);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  async function handleCreate() {
    if (!contentId) {
      setError('Abra um título e inicie a reprodução para criar uma sala.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const created = await createWatchParty({
        contentId,
        sessionId,
        displayName: name,
      });
      setRoom(created);
      setMsg(`Sala ${created.code} criada`);
      if (Platform.OS === 'web' && created.shareUrl) {
        navigator.clipboard?.writeText?.(created.shareUrl);
      }
    } catch (err) {
      setError(err.message || 'Falha ao criar sala');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setLoading(true);
    setError('');
    try {
      const joined = await joinWatchParty({ code: code.trim(), displayName: name });
      setRoom(joined);
      setMsg(`Entrou na sala ${joined.code}`);
    } catch (err) {
      setError(err.message || 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnd() {
    if (!room?.id) return;
    try {
      const isHost = room.members?.some((m) => m.isHost && m.displayName === name);
      if (isHost || room.hostUserId) {
        await endWatchParty(room.id).catch(() => leaveWatchParty(room.id));
      } else {
        await leaveWatchParty(room.id);
      }
      setRoom(null);
      setMsg('Saiu da sala');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: isCompact ? 16 : 40,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 12,
        }}
      >
        <Focusable id="wt-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', flex: 1 }}>
          Watch Together
        </Text>
        <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1 }}>
          {brand.name.toUpperCase()}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: isCompact ? 16 : 40,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          gap: 14,
        }}
      >
        <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
          Veja o mesmo título em sincronia com amigos — código de sala · máx. 8 pessoas.
        </Text>

        {error ? <Text style={{ color: colors.red }}>{error}</Text> : null}
        {msg ? <Text style={{ color: colors.gold }}>{msg}</Text> : null}

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="O seu nome na sala"
          placeholderTextColor={colors.muted}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.text,
            padding: 12,
            borderRadius: 4,
          }}
        />

        {!room ? (
          <>
            <Pressable
              onPress={handleCreate}
              disabled={loading}
              style={{
                backgroundColor: colors.red,
                paddingVertical: 14,
                alignItems: 'center',
                borderRadius: 4,
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '800' }}>
                {loading ? '…' : 'Criar sala'}
              </Text>
            </Pressable>

            <Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 8 }}>OU</Text>

            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              placeholder="Código da sala"
              placeholderTextColor={colors.muted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                padding: 12,
                borderRadius: 4,
                letterSpacing: 2,
                fontWeight: '800',
                textAlign: 'center',
              }}
            />
            <Pressable
              onPress={handleJoin}
              disabled={loading}
              style={{
                borderWidth: 1,
                borderColor: colors.gold,
                paddingVertical: 14,
                alignItems: 'center',
                borderRadius: 4,
              }}
            >
              <Text style={{ color: colors.gold, fontWeight: '800' }}>Entrar na sala</Text>
            </Pressable>
          </>
        ) : (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 16,
              backgroundColor: colors.elevated,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }}>
              SALA ACTIVA
            </Text>
            <Text style={{ color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: 4 }}>
              {room.code}
            </Text>
            <Text style={{ color: colors.textSecondary }}>{room.contentTitle}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Posição ~{Math.floor((room.positionSeconds || 0) / 60)}m ·{' '}
              {room.isPlaying ? 'A reproduzir' : 'Pausa'} · {room.members?.length || 0}/
              {room.maxMembers}
            </Text>

            <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '800', marginTop: 8 }}>
              MEMBROS
            </Text>
            {(room.members || []).map((m) => (
              <Text key={m.userId} style={{ color: colors.text }}>
                {m.isHost ? '★ ' : '· '}
                {m.displayName}
              </Text>
            ))}

            <Pressable
              onPress={() => onOpenWatch?.(room.contentId)}
              style={{
                marginTop: 8,
                backgroundColor: colors.text,
                paddingVertical: 12,
                alignItems: 'center',
                borderRadius: 4,
              }}
            >
              <Text style={{ color: colors.black, fontWeight: '800' }}>Assistir agora</Text>
            </Pressable>
            <Pressable onPress={handleEnd} style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.red, fontWeight: '700' }}>Sair / Terminar</Text>
            </Pressable>
            {loading ? <ActivityIndicator color={colors.red} /> : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
