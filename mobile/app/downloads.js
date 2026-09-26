import { Redirect, useRouter } from 'expo-router';
import DownloadsScreen from '../src/screens/Downloads';
import { useAuth } from '../src/context/AuthContext';

export default function DownloadsRoute() {
  const router = useRouter();
  const { isAuthenticated, hasProfile } = useAuth();

  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!hasProfile) return <Redirect href="/profiles" />;

  return <DownloadsScreen onBack={() => router.back()} />;
}
