import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import { PrimaryButton } from '../components/ui';
import { fetchPlans } from '../services/plans';
import Focusable from '../tv/Focusable';
import { ErrorState } from '../components/StateViews';

export default function Plans({ onBack, onSubscribe, onPacks, currentStatus }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await fetchPlans();
      setPlans(data.plans || []);
      setNote(data.note || '');
    } catch (err) {
      setError(err.message || 'Falha ao carregar planos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isPremium = currentStatus === 'premium_active';

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
        }}
      >
        <Focusable id="plans-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: 16, flex: 1 }}>
          Planos
        </Text>
        <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1 }}>
          {brand.name.toUpperCase()}
        </Text>
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
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
            Escolha o seu plano
          </Text>
          <Text style={{ color: colors.muted, marginBottom: 28, lineHeight: 22 }}>
            Feito para Angola — IBAN e Multicaixa, sem cartão internacional.
          </Text>

          {error ? <ErrorState message={error} onRetry={load} /> : null}

          <View
            style={{
              flexDirection: isCompact ? 'column' : 'row',
              gap: 16,
            }}
          >
            {plans.map((plan) => {
              const featured = plan.id === 'premium';
              const active =
                (plan.id === 'premium' && isPremium) || (plan.id === 'free' && !isPremium);
              return (
                <View
                  key={plan.id}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: featured ? colors.gold : colors.border,
                    borderTopWidth: 4,
                    borderTopColor: featured ? colors.gold : colors.red,
                    borderRadius: 8,
                    padding: 20,
                    backgroundColor: '#0F0F0F',
                  }}
                >
                  {plan.badge ? (
                    <Text
                      style={{
                        color: colors.black,
                        backgroundColor: colors.gold,
                        alignSelf: 'flex-start',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        fontSize: 10,
                        fontWeight: '800',
                        marginBottom: 12,
                      }}
                    >
                      {plan.badge.toUpperCase()}
                    </Text>
                  ) : null}
                  <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
                    {plan.name}
                  </Text>
                  <Text style={{ color: colors.gold, fontSize: 28, fontWeight: '800', marginTop: 8 }}>
                    {plan.priceKz
                      ? `${plan.priceKz.toLocaleString('pt-AO')} Kz`
                      : '0 Kz'}
                    {plan.period ? (
                      <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '500' }}>
                        {' '}/ mês
                      </Text>
                    ) : null}
                  </Text>
                  {active ? (
                    <Text style={{ color: colors.gold, marginTop: 8, fontWeight: '700', fontSize: 12 }}>
                      PLANO ACTUAL
                    </Text>
                  ) : null}
                  <View style={{ marginTop: 18, gap: 10 }}>
                    {(plan.highlights || []).map((h) => (
                      <View key={h} style={{ flexDirection: 'row', gap: 8 }}>
                        <Ionicons name="checkmark" size={16} color={colors.gold} />
                        <Text style={{ color: colors.textSecondary, flex: 1, lineHeight: 20 }}>
                          {h}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {plan.cta && !isPremium ? (
                    <PrimaryButton
                      label={plan.cta.label}
                      variant="light"
                      style={{ marginTop: 24 }}
                      onPress={() => onSubscribe?.(plan)}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>

          {note ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 28, lineHeight: 18 }}>
              {note}
            </Text>
          ) : null}

          {onPacks ? (
            <PrimaryButton
              label="Ver packs TVOD"
              variant="outline"
              style={{ marginTop: 24 }}
              onPress={onPacks}
            />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
