import { Redirect, useRouter } from 'expo-router';
import PacksScreen from '../src/screens/Packs';
import { useAuth } from '../src/context/AuthContext';

export default function PacksRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <PacksScreen
      onBack={() => router.back()}
      onCheckout={(pack) =>
        router.push({
          pathname: '/checkout',
          params: { type: 'pack', packId: pack.id, packTitle: pack.title, priceKz: String(pack.priceKz) },
        })
      }
    />
  );
}
