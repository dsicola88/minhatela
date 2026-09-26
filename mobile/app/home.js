import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import HomeScreen from '../src/screens/Home';
import Details from '../src/screens/Details';
import { useAuth } from '../src/context/AuthContext';

export default function HomeRoute() {
  const router = useRouter();
  const { isAuthenticated, hasProfile, user } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (!hasProfile) {
    return <Redirect href="/profiles" />;
  }

  return (
    <>
      <HomeScreen
        onOpenDetails={(item) => {
          setSelectedId(item.id);
          setDetailsOpen(true);
        }}
        onPlay={(item) => router.push(`/watch/${item.id}`)}
        onCreatorStudio={() => router.push('/creator-studio')}
        onAds={() => router.push('/ads')}
        onSearch={() => router.push('/search')}
        onAdmin={
          user?.isAdmin
            ? () => router.push('/admin')
            : undefined
        }
        onProfile={() => router.push('/account')}
        onNotifications={() => router.push('/notifications')}
        onMyList={() => router.push('/my-list')}
        onNewHot={() => router.push('/new-hot')}
        onPremieres={() => router.push('/premieres')}
        onForYou={() => router.push('/for-you')}
        onLanguages={() => router.push('/languages')}
        onBrowse={(kind) => {
          if (kind === 'angola') router.push('/browse/Cinema%20Angolano');
          else if (kind === 'series') router.push('/browse/Web-s%C3%A9rie');
          else router.push('/browse');
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
        onPerson={(person) => {
          setDetailsOpen(false);
          router.push(`/person/${person.slug}`);
        }}
        onWatchTogether={(video) => {
          setDetailsOpen(false);
          router.push({
            pathname: '/watch-together',
            params: { contentId: video.id },
          });
        }}
      />
    </>
  );
}
