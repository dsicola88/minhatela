import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout } from '../theme/tokens';
import { LoadingState, ErrorState } from '../components/StateViews';
import Focusable from '../tv/Focusable';
import {
  listMyGifts,
  purchaseGift,
  redeemGift,
} from '../services/gifts';

const DAY_OPTIONS = [7, 30, 90];

export default function Gifts({ onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [days, setDays] = useState(30);
  const [redeemCode, setRedeemCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await listMyGifts();
      setGifts(res.gifts || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar presentes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onPurchase() {
    try {
      setBusy(true);
      setMsg('');
      const res = await purchaseGift({ days });
      setMsg(`Presente criado: ${res.gift?.code}`);
      await load();
    } catch (err) {
      setMsg(err.message || 'Não foi possível criar o presente');
    } finally {
      setBusy(false);
    }
  }

  async function onRedeem() {
    try {
      setBusy(true);
      setMsg('');
      const res = await redeemGift(redeemCode.trim());
      setMsg(res.message || 'Presente resgatado');
      setRedeemCode('');
      await load();
    } catch (err) {
      setMsg(err.message || 'Código inválido');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Focusable id="gifts-back" onPress={onBack} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginLeft: 16 }}>
          Presentes Premium
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 80,
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />}
      >
        <Text style={{ color: colors.textSecondary, marginBottom: 20, lineHeight: 22 }}>
          Ofereça Premium MinhaTela a família e amigos. Código único · resgate em segundos.
        </Text>

        <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 12 }}>
          CRIAR PRESENTE
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {DAY_OPTIONS.map((d) => (
            <Pressable
              key={d}
              onPress={() => setDays(d)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: days === d ? colors.gold : colors.border,
                backgroundColor: days === d ? 'rgba(247,212,23,0.12)' : 'transparent',
              }}
            >
              <Text style={{ color: days === d ? colors.gold : colors.text, fontWeight: '700' }}>
                {d} dias
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={onPurchase}
          disabled={busy}
          style={{
            backgroundColor: colors.red,
            paddingVertical: 14,
            alignItems: 'center',
            borderRadius: 4,
            marginBottom: 28,
            opacity: busy ? 0.7 : 1,
            maxWidth: width > 500 ? 280 : undefined,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800' }}>Gerar código</Text>
        </Pressable>

        <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 12 }}>
          RESGATAR
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <TextInput
            value={redeemCode}
            onChangeText={setRedeemCode}
            autoCapitalize="characters"
            placeholder="Código do presente"
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
              letterSpacing: 1,
            }}
          />
          <Pressable
            onPress={onRedeem}
            disabled={busy}
            style={{
              backgroundColor: colors.gold,
              paddingHorizontal: 18,
              justifyContent: 'center',
              borderRadius: 4,
            }}
          >
            <Text style={{ color: colors.black, fontWeight: '800' }}>Usar</Text>
          </Pressable>
        </View>
        {msg ? (
          <Text style={{ color: colors.gold, marginBottom: 20, fontSize: 13 }}>{msg}</Text>
        ) : null}

        <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 12 }}>
          OS SEUS PRESENTES
        </Text>
        {gifts.length === 0 ? (
          <Text style={{ color: colors.muted }}>Ainda não criou presentes.</Text>
        ) : (
          gifts.map((g) => (
            <View
              key={g.id}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingVertical: 14,
              }}
            >
              <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 18, letterSpacing: 2 }}>
                {g.code}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>
                {g.days} dias · {g.status}
                {g.expiresAt
                  ? ` · expira ${new Date(g.expiresAt).toLocaleDateString('pt-AO')}`
                  : ''}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
