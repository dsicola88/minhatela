import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/engagement';
import Focusable from '../tv/Focusable';

const TYPE_ICON = {
  payment_approved: 'checkmark-circle',
  payment_rejected: 'close-circle',
  payment_submitted: 'time',
  default: 'notifications',
};

export default function Notifications({ onBack, onOpenPayment }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await fetchNotifications();
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
    } catch (err) {
      setError(err.message || 'Falha ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRead(item) {
    if (item.unread) {
      try {
        const res = await markNotificationRead(item.id);
        setUnread(res.unread || 0);
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, unread: false, readAt: new Date().toISOString() } : n))
        );
      } catch {
        // ignore
      }
    }
    if (item.type?.startsWith('payment') && onOpenPayment) {
      onOpenPayment();
    }
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  }

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
        <Focusable id="notif-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 16, flex: 1 }}>
          Notificações
        </Text>
        {unread > 0 ? (
          <Pressable onPress={handleMarkAll}>
            <Text style={{ color: colors.gold, fontWeight: '600', fontSize: 13 }}>Marcar tudo</Text>
          </Pressable>
        ) : (
          <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1 }}>
            {brand.name.toUpperCase()}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.red} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: isCompact ? 16 : 40,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            paddingBottom: 64,
          }}
        >
          {error ? <Text style={{ color: colors.red, marginBottom: 12 }}>{error}</Text> : null}
          {!items.length ? (
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 48 }}>
              Sem notificações por agora.
            </Text>
          ) : (
            items.map((item) => (
              <Focusable
                key={item.id}
                id={`notif-${item.id}`}
                onPress={() => handleRead(item)}
                style={{
                  flexDirection: 'row',
                  gap: 14,
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  opacity: item.unread ? 1 : 0.7,
                }}
              >
                <Ionicons
                  name={TYPE_ICON[item.type] || TYPE_ICON.default}
                  size={24}
                  color={item.type === 'payment_approved' ? colors.gold : colors.red}
                />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{item.title}</Text>
                    {item.unread ? (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.red,
                        }}
                      />
                    ) : null}
                  </View>
                  <Text style={{ color: colors.textSecondary, marginTop: 4, lineHeight: 20 }}>
                    {item.body}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
                    {new Date(item.createdAt).toLocaleString('pt-AO')}
                  </Text>
                </View>
              </Focusable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
