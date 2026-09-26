import { Redirect, useRouter } from 'expo-router';
import HistoryScreen from '../src/screens/History';
import { useAuth } from '../src/context/AuthContext';

export default function HistoryRoute() {
  const router = useRouter();
  const { isAuthenticated, hasProfile } = useAuth();

  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!hasProfile) return <Redirect href="/profiles" />;

  return (
    <HistoryScreen
      onBack={() => router.back()}
      onPlay={(item) => router.push(`/watch/${item.id}`)}
    />
  );
}
