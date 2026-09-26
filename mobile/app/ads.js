import { Redirect, useRouter } from 'expo-router';
import AdPortalScreen from '../src/screens/AdPortal';
import { useAuth } from '../src/context/AuthContext';

export default function AdsRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return <AdPortalScreen onBack={() => router.replace('/home')} />;
}
