import { useRouter } from 'expo-router';
import HelpCenter from '../src/screens/HelpCenter';
import { useAuth } from '../src/context/AuthContext';
import { Redirect } from 'expo-router';

export default function HelpRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/login" />;
  return <HelpCenter onBack={() => router.back()} />;
}
