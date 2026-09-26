import { Redirect, useRouter } from 'expo-router';
import MyPaymentsScreen from '../src/screens/MyPayments';
import { useAuth } from '../src/context/AuthContext';

export default function PaymentsRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Redirect href="/login" />;

  return <MyPaymentsScreen onBack={() => router.back()} />;
}
