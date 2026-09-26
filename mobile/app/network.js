import { Redirect, useRouter } from 'expo-router';
import NetworkDiagnosticsScreen from '../src/screens/NetworkDiagnostics';
import { useAuth } from '../src/context/AuthContext';

export default function NetworkRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/login" />;
  return <NetworkDiagnosticsScreen onBack={() => router.back()} />;
}
