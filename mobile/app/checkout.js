import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import CheckoutScreen from '../src/screens/Checkout';
import { useAuth } from '../src/context/AuthContext';

export default function CheckoutRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  const type =
    params.type === 'rental' ? 'rental' : params.type === 'pack' ? 'pack' : 'subscription';
  const video = params.videoId
    ? {
        id: params.videoId,
        title: params.title || 'Conteúdo',
        rentalPriceKz: params.price ? Number(params.price) : 1500,
      }
    : null;
  const pack =
    type === 'pack'
      ? {
          id: params.packId,
          title: params.packTitle || 'Pack TVOD',
          priceKz: params.priceKz ? Number(params.priceKz) : 2500,
        }
      : null;

  return (
    <CheckoutScreen
      type={type}
      video={video}
      pack={pack}
      onBack={() => router.back()}
      onSubmitted={() => {
        setTimeout(() => router.replace('/home'), 1200);
      }}
    />
  );
}
