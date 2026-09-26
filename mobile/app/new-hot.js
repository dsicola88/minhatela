import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import NewAndHotScreen from '../src/screens/NewAndHot';
import Details from '../src/screens/Details';
import { useAuth } from '../src/context/AuthContext';

export default function NewAndHotRoute() {
  const router = useRouter();
  const { isAuthenticated, hasProfile } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!hasProfile) return <Redirect href="/profiles" />;

  return (
    <>
      <NewAndHotScreen
        onBack={() => router.back()}
        onSelect={(item) => {
          setSelectedId(item.id);
          setDetailsOpen(true);
        }}
      />
      <Details
        visible={detailsOpen}
        videoId={selectedId}
        onClose={() => setDetailsOpen(false)}
        onWatch={(video) => {
          setDetailsOpen(false);
          router.push(`/watch/${video.id}`);
        }}
        onCheckout={({ type, video }) => {
          setDetailsOpen(false);
          router.push({
            pathname: '/checkout',
            params: {
              type,
              videoId: video?.id || '',
              title: video?.title || '',
              price: String(video?.rentalPriceKz || ''),
            },
          });
        }}
      />
    </>
  );
}
