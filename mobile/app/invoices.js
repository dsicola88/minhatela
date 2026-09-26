import { Redirect, useRouter } from 'expo-router';
import InvoicesScreen from '../src/screens/Invoices';
import { useAuth } from '../src/context/AuthContext';

export default function InvoicesRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/login" />;
  return <InvoicesScreen onBack={() => router.back()} />;
}
