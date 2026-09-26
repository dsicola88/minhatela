import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, FieldLabel } from '../components/ui';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { colors, layout } from '../theme/tokens';
import { registerAdvertiser, fetchAdPortal, createCampaign } from '../services/ads';

export default function AdPortal({ onBack }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [campaign, setCampaign] = useState({
    name: '',
    budgetKz: '50000',
    placement: 'pre_roll',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    mediaUrl: '',
    clickUrl: '',
  });

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await fetchAdPortal();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          padding: isCompact ? 16 : 32,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 80,
        }}
      >
        <Pressable
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={{ color: colors.textSecondary }}>Voltar</Text>
        </Pressable>

        <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }}>
          AD PLATFORM
        </Text>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
          Portal de Anunciantes
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 22, lineHeight: 22 }}>
          Campanhas AVOD com targeting em Angola. Sem dados pessoais de clientes.
        </Text>

        {error ? <ErrorState message={error} onRetry={load} /> : null}

        {!data?.advertiser ? (
          <View style={panelStyle}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              Registar anunciante
            </Text>
            <FieldLabel>Empresa</FieldLabel>
            <TextInput
              value={companyName}
              onChangeText={setCompanyName}
              style={inputStyle}
              placeholderTextColor={colors.muted}
            />
            <FieldLabel>Email de contacto</FieldLabel>
            <TextInput
              value={contactEmail}
              onChangeText={setContactEmail}
              style={inputStyle}
              autoCapitalize="none"
              placeholderTextColor={colors.muted}
            />
            <PrimaryButton
              label="Criar conta anunciante"
              variant="gold"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await registerAdvertiser({ companyName, contactEmail });
                  await load();
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        ) : (
          <>
            <View style={panelStyle}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>
                {data.advertiser.companyName}
              </Text>
              <Text style={{ color: colors.muted }}>{data.advertiser.contactEmail}</Text>
            </View>

            {data.stats ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                <MiniStat label="Campanhas" value={data.stats.campaigns} />
                <MiniStat label="Impressões" value={data.stats.impressions} />
                <MiniStat label="CTR %" value={data.stats.ctr} gold />
                <MiniStat label="Spend (Kz)" value={data.stats.spentKz} />
              </View>
            ) : null}

            <View style={panelStyle}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
                Nova campanha
              </Text>
              <FieldLabel>Nome</FieldLabel>
              <TextInput
                value={campaign.name}
                onChangeText={(v) => setCampaign((s) => ({ ...s, name: v }))}
                style={inputStyle}
                placeholderTextColor={colors.muted}
              />
              <FieldLabel>Orçamento (Kz)</FieldLabel>
              <TextInput
                value={campaign.budgetKz}
                onChangeText={(v) => setCampaign((s) => ({ ...s, budgetKz: v }))}
                style={inputStyle}
                keyboardType="numeric"
                placeholderTextColor={colors.muted}
              />
              <FieldLabel>Media URL (criativo)</FieldLabel>
              <TextInput
                value={campaign.mediaUrl}
                onChangeText={(v) => setCampaign((s) => ({ ...s, mediaUrl: v }))}
                style={inputStyle}
                autoCapitalize="none"
                placeholderTextColor={colors.muted}
              />
              <PrimaryButton
                label="Submeter campanha"
                loading={busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await createCampaign({
                      name: campaign.name,
                      budgetKz: Number(campaign.budgetKz),
                      placement: campaign.placement,
                      startsAt: campaign.startsAt,
                      endsAt: campaign.endsAt,
                      creative: {
                        title: campaign.name,
                        mediaUrl: campaign.mediaUrl,
                        clickUrl: campaign.clickUrl,
                      },
                    });
                    await load();
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </View>

            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
              Campanhas
            </Text>
            {(data.campaigns || []).length === 0 ? (
              <EmptyState title="Sem campanhas" subtitle="Crie a primeira campanha AVOD." />
            ) : (
              data.campaigns.map((item) => (
                <View key={item.id} style={panelStyle}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: colors.gold, marginTop: 4 }}>
                    {item.status} · {item.placement}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 6 }}>
                    Budget {item.budgetKz.toLocaleString('pt-AO')} Kz · Spend{' '}
                    {item.spentKz.toLocaleString('pt-AO')} Kz
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MiniStat({ label, value, gold }) {
  return (
    <View
      style={{
        flexGrow: 1,
        minWidth: 120,
        backgroundColor: '#111111',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.border,
        borderTopWidth: 2,
        borderTopColor: gold ? colors.gold : colors.red,
        padding: 12,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 20, marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

const panelStyle = {
  backgroundColor: '#111111',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: colors.border,
  padding: 16,
  marginBottom: 14,
};

const inputStyle = {
  backgroundColor: '#181818',
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 4,
  color: colors.text,
  paddingHorizontal: 12,
  paddingVertical: 12,
  marginBottom: 12,
};
