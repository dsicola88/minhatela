import { useRouter } from 'expo-router';
import { Linking, Alert, Platform } from 'react-native';
import PremieresScreen from '../src/screens/Premieres';

export default function PremieresRoute() {
  const router = useRouter();
  return (
    <PremieresScreen
      onBack={() => router.back()}
      onOpenTitle={(id) => router.push(`/title/${id}`)}
      onWatchLive={(data) => {
        const url = data?.playback?.embedUrl || data?.playback?.hlsUrl;
        if (!url) {
          Alert.alert('Stream', 'URL de transmissão indisponível');
          return;
        }
        if (data?.playback?.embedUrl) {
          // Live joins use signed embed when Bunny available
          router.push({
            pathname: '/watch/[id]',
            params: { id: data.eventId, liveUrl: data.playback.embedUrl },
          });
          return;
        }
        if (Platform.OS === 'web') {
          window.open(url, '_blank');
        } else {
          Linking.openURL(url);
        }
      }}
    />
  );
}
