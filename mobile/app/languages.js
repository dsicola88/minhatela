import { Redirect, useRouter } from 'expo-router';
import LanguagesHubScreen from '../src/screens/LanguagesHub';
import { useAuth } from '../src/context/AuthContext';

export default function LanguagesRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/login" />;
  return (
    <LanguagesHubScreen
      onBack={() => router.back()}
      onOpenDetails={(item) => router.push(`/title/${item.id}`)}
    />
  );
}
