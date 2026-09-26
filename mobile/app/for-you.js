import { Redirect, useRouter } from 'expo-router';
import ForYouScreen from '../src/screens/ForYou';
import { useAuth } from '../src/context/AuthContext';

export default function ForYouRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <ForYouScreen
      onBack={() => router.back()}
      onOpenDetails={(item) => router.push(`/title/${item.id}`)}
    />
  );
}
