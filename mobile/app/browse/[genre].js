import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import BrowseGenreScreen from '../../src/screens/BrowseGenre';
import Details from '../../src/screens/Details';
import { useAuth } from '../../src/context/AuthContext';

export default function BrowseGenreRoute() {
  const router = useRouter();
  const { genre } = useLocalSearchParams();
  const { isAuthenticated, hasProfile } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!hasProfile) return <Redirect href="/profiles" />;

  return (
    <>
      <BrowseGenreScreen
        genre={typeof genre === 'string' ? decodeURIComponent(genre) : ''}
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
