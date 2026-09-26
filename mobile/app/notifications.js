import { Redirect, useRouter } from 'expo-router';
import NotificationsScreen from '../src/screens/Notifications';
import { useAuth } from '../src/context/AuthContext';

export default function NotificationsRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <NotificationsScreen
      onBack={() => router.back()}
      onOpenPayment={() => router.push('/payments')}
    />
  );
}
