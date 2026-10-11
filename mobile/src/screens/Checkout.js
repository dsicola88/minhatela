import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { PrimaryButton, FieldLabel } from '../components/ui';
import { colors, layout } from '../theme/tokens';
import {
  fetchPaymentMethods,
  submitCheckout,
  startWeframeSession,
  fetchWeframeSession,
} from '../services/payments';

export default function Checkout({
  type = 'subscription',
  video = null,
  pack = null,
  onBack,
  onSubmitted,
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [methods, setMethods] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('weframe');
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [weframeTxId, setWeframeTxId] = useState(null);

  const amount =
    type === 'rental'
      ? video?.rentalPriceKz || 1500
      : type === 'pack'
        ? pack?.priceKz || 2500
        : methods?.premiumPriceKz || 4990;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchPaymentMethods();
        if (!mounted) return;
        setMethods(data);
        const first = data?.methods?.[0]?.id;
        if (first) setPaymentMethod(first);
      } catch (err) {
        if (mounted) setError(err.message || 'Falha ao carregar métodos de pagamento');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setProof({
        uri: asset.uri,
        name: asset.fileName || 'comprovativo.jpg',
        mimeType: asset.mimeType || 'image/jpeg',
      });
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setProof({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/pdf',
      });
    }
  }

  useEffect(() => {
    if (!weframeTxId) return undefined;
    let cancelled = false;
    let settled = false;
    let id;
    const tick = async () => {
      if (settled || cancelled) return;
      try {
        const data = await fetchWeframeSession(weframeTxId);
        const status = data?.transaction?.status;
        if (!cancelled && (status === 'paid' || status === 'pago')) {
          settled = true;
          if (id) clearInterval(id);
          setSuccess('Pagamento confirmado. O acesso já está libertado.');
          onSubmitted?.(data);
        }
      } catch {
        /* keep polling */
      }
    };
    id = setInterval(tick, 4000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [weframeTxId, onSubmitted]);

  async function handleSubmit() {
    setError('');
    setSuccess('');
    if (paymentMethod === 'weframe') {
      setSubmitting(true);
      try {
        const result = await startWeframeSession({
          type,
          videoId: video?.id,
          packId: pack?.id,
        });
        setEmbedUrl(result.embedUrl);
        setWeframeTxId(result.transaction?.id || null);
        setSuccess(result.message || 'Abra o Multicaixa Express para confirmar.');
      } catch (err) {
        setError(err.message || 'Não foi possível abrir o checkout Multicaixa Express');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!proof) {
      setError('Carregue o comprovativo da transferência.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitCheckout({
        type,
        paymentMethod,
        videoId: video?.id,
        packId: pack?.id,
        proof,
      });
      setSuccess(result.message);
      onSubmitted?.(result);
    } catch (err) {
      setError(err.message || 'Não foi possível enviar o comprovativo');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.red} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          padding: isCompact ? 16 : 40,
          maxWidth: 760,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 64,
        }}
      >
        <Pressable
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={{ color: colors.textSecondary }}>Voltar</Text>
        </Pressable>

        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
          Checkout Angola
        </Text>
        <Text style={{ color: colors.textSecondary, marginBottom: 28, lineHeight: 22 }}>
          Multicaixa Express neste ecrã, ou IBAN com comprovativo. (
          {type === 'rental' ? 'aluguer 48h' : type === 'pack' ? 'pack TVOD' : 'Premium'})
        </Text>

        <View
          style={{
            backgroundColor: colors.elevated,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderTopWidth: 3,
            borderTopColor: colors.gold,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text style={{ color: colors.gold, fontWeight: '700', marginBottom: 8 }}>
            Resumo
          </Text>
          <Text style={{ color: colors.text, fontSize: 16, marginBottom: 4 }}>
            {type === 'rental'
              ? `Aluguer · ${video?.title}`
              : type === 'pack'
                ? `Pack · ${pack?.title}`
                : 'Assinatura Premium · 30 dias'}
          </Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>
            {Number(amount).toLocaleString('pt-AO')} Kz
          </Text>
        </View>

        <FieldLabel>Método de pagamento</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          {(methods?.methods || []).map((method) => {
            const active = paymentMethod === method.id;
            return (
              <Pressable
                key={method.id}
                onPress={() => setPaymentMethod(method.id)}
                style={{
                  flexGrow: 1,
                  minWidth: 140,
                  borderWidth: 1,
                  borderColor: active ? colors.red : colors.border,
                  backgroundColor: active ? 'rgba(206,17,38,0.12)' : colors.elevated,
                  borderRadius: 6,
                  padding: 14,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>
                  {method.label}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{method.description}</Text>
              </Pressable>
            );
          })}
        </View>

        {paymentMethod !== 'weframe' ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>
            Dados para transferência
          </Text>
          <InfoRow label="Titular" value={methods?.platform?.accountName} />
          <InfoRow label="Banco" value={methods?.platform?.bankName} />
          <InfoRow label="IBAN" value={methods?.platform?.iban} />
          {methods?.platform?.multicaixaRef ? (
            <InfoRow label="Multicaixa" value={methods.platform.multicaixaRef} />
          ) : null}
        </View>
        ) : null}

        {paymentMethod === 'weframe' && embedUrl ? (
          <View
            style={{
              height: 520,
              marginBottom: 16,
              borderRadius: 8,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.gold,
            }}
          >
            {Platform.OS === 'web' ? (
              <iframe
                title="Multicaixa Express"
                src={embedUrl}
                style={{ width: '100%', height: '100%', border: 0, background: '#111' }}
              />
            ) : (
              <WebView
                source={{ uri: embedUrl }}
                onMessage={(event) => {
                  try {
                    const payload = JSON.parse(event.nativeEvent.data);
                    if (payload?.paid) {
                      setSuccess('Pagamento confirmado. O acesso já está libertado.');
                    }
                  } catch {
                    /* ignore */
                  }
                }}
              />
            )}
          </View>
        ) : null}

        {paymentMethod !== 'weframe' ? (
        <>
        <FieldLabel>Comprovativo (imagem ou PDF)</FieldLabel>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <PrimaryButton label="Galeria" variant="outline" onPress={pickImage} style={{ flex: 1 }} />
          <PrimaryButton label="Ficheiro" variant="outline" onPress={pickDocument} style={{ flex: 1 }} />
        </View>

        {proof ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              padding: 12,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: colors.gold,
              backgroundColor: 'rgba(247,212,23,0.06)',
            }}
          >
            {proof.mimeType?.startsWith('image/') ? (
              <Image source={{ uri: proof.uri }} style={{ width: 48, height: 48, borderRadius: 4 }} />
            ) : (
              <Ionicons name="document-text" size={28} color={colors.gold} />
            )}
            <Text style={{ color: colors.text, flex: 1 }} numberOfLines={2}>
              {proof.name}
            </Text>
          </View>
        ) : null}
        </>
        ) : null}

        {error ? <Text style={{ color: colors.red, marginBottom: 12 }}>{error}</Text> : null}
        {success ? <Text style={{ color: colors.success, marginBottom: 12 }}>{success}</Text> : null}

        {paymentMethod === 'weframe' && embedUrl ? null : (
        <PrimaryButton
          label={paymentMethod === 'weframe' ? 'Pagar com Multicaixa Express' : 'Enviar comprovativo'}
          onPress={handleSubmit}
          loading={submitting}
          variant="gold"
        />
        )}

        <Text
          style={{
            color: colors.muted,
            fontSize: 12,
            marginTop: 16,
            lineHeight: 18,
            maxWidth: layout.maxContentWidth,
          }}
        >
          Estado inicial: pendente. O conteúdo TVOD expira exactamente 48 horas após a confirmação
          do pagamento (não após o envio do comprovativo).
        </Text>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 2 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '600' }}>{value || '—'}</Text>
    </View>
  );
}
