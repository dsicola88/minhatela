import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import QRCode from 'qrcode/lib/core/qrcode';
import { colors } from '../theme/tokens';

const CELL = 5;
const QUIET = 2;

export default function TotpQr({ otpauthUrl, secret }) {
  const [showSecret, setShowSecret] = useState(false);
  const matrix = useMemo(() => {
    if (!otpauthUrl) return null;
    try {
      return QRCode.create(otpauthUrl, { errorCorrectionLevel: 'M' }).modules;
    } catch {
      return null;
    }
  }, [otpauthUrl]);

  const size = matrix?.size || 0;
  const span = size + QUIET * 2;

  return (
    <View style={{ marginTop: 8, marginBottom: 4 }}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
        Leia este código no telemóvel
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 6 }}>
        No Google Authenticator, toque em + e escolha ler um código QR. Depois escreva aqui os 6 dígitos.
      </Text>
      {matrix ? (
        <View
          style={{
            alignSelf: 'center',
            marginTop: 14,
            backgroundColor: '#FFFFFF',
            padding: QUIET * CELL,
          }}
        >
          {Array.from({ length: span }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {Array.from({ length: span }, (_, col) => {
                const inside =
                  row >= QUIET &&
                  col >= QUIET &&
                  row < size + QUIET &&
                  col < size + QUIET &&
                  matrix.get(row - QUIET, col - QUIET);
                return (
                  <View
                    key={col}
                    style={{
                      width: CELL,
                      height: CELL,
                      backgroundColor: inside ? '#000000' : '#FFFFFF',
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
      <Pressable onPress={() => setShowSecret((v) => !v)} style={{ marginTop: 12 }}>
        <Text style={{ color: colors.gold, fontSize: 13, fontWeight: '600' }}>
          {showSecret ? 'Esconder a chave' : 'Não consegue ler? Mostrar a chave'}
        </Text>
      </Pressable>
      {showSecret && secret ? (
        <Text
          selectable
          style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, letterSpacing: 0.4 }}
        >
          {secret}
        </Text>
      ) : null}
    </View>
  );
}
