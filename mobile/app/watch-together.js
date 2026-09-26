import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import WatchTogether from '../src/screens/WatchTogether';
import { useAuth } from '../src/context/AuthContext';

export default function WatchTogetherRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { code, contentId, sessionId } = useLocalSearchParams();

  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <WatchTogether
      initialCode={typeof code === 'string' ? code : undefined}
      contentId={typeof contentId === 'string' ? contentId : undefined}
      sessionId={typeof sessionId === 'string' ? sessionId : undefined}
      onBack={() => router.back()}
      onOpenWatch={(id) => router.push(`/watch/${id}`)}
    />
  );
}
