import { Redirect, useRouter } from 'expo-router';
import PlansScreen from '../src/screens/Plans';
import { useAuth } from '../src/context/AuthContext';

export default function PlansRoute() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <PlansScreen
      currentStatus={user?.subscriptionStatus}
      onBack={() => router.back()}
      onPacks={() => router.push('/packs')}
      onSubscribe={() =>
        router.push({
          pathname: '/checkout',
          params: { type: 'subscription' },
        })
      }
    />
  );
}
