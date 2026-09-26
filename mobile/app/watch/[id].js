import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import WatchScreen from '../../src/screens/Watch';
import { useAuth } from '../../src/context/AuthContext';

export default function WatchRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <WatchScreen
      videoId={id}
      onBack={() => router.back()}
      onNextEpisode={(episode) => {
        router.replace(`/watch/${episode.id}`);
      }}
      onWatchTogether={({ contentId, sessionId }) => {
        router.push({
          pathname: '/watch-together',
          params: { contentId, sessionId },
        });
      }}
      onOpenTitle={(titleId) => router.push(`/title/${titleId}`)}
    />
  );
}
