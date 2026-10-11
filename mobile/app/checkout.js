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

  const one = (value) => (Array.isArray(value) ? value[0] : value);
  const typeRaw = one(params.type);
  const type =
    typeRaw === 'rental'
      ? 'rental'
      : typeRaw === 'pack'
        ? 'pack'
        : typeRaw === 'ad_campaign'
          ? 'ad_campaign'
          : 'subscription';
  const video = one(params.videoId)
    ? {
        id: one(params.videoId),
        title: one(params.title) || 'Conteúdo',
        rentalPriceKz: one(params.price) ? Number(one(params.price)) : 1500,
      }
    : null;
  const pack =
    type === 'pack'
      ? {
          id: one(params.packId),
          title: one(params.packTitle) || 'Lote de filmes',
          priceKz: one(params.priceKz) ? Number(one(params.priceKz)) : 2500,
        }
      : null;

  return (
    <CheckoutScreen
      type={type}
      video={video}
      pack={pack}
      onBack={() => router.back()}
      campaignId={one(params.campaignId) || null}
      campaignTitle={one(params.title) || ''}
      campaignPriceKz={one(params.priceKz) ? Number(one(params.priceKz)) : null}
      onSubmitted={() => {
        setTimeout(
          () => router.replace(type === 'ad_campaign' ? '/ads' : '/home'),
          1200
        );
      }}
    />
  );
}
