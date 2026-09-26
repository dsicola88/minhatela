import { Redirect, useRouter } from 'expo-router';
import BrowseGenreScreen from '../../src/screens/BrowseGenre';
import { useAuth } from '../../src/context/AuthContext';

export default function BrowseRoute() {
  const router = useRouter();
  const { isAuthenticated, hasProfile } = useAuth();

  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!hasProfile) return <Redirect href="/profiles" />;

  return (
    <BrowseGenreScreen
      onBack={() => router.back()}
      onSelect={(item) => router.push(`/title/${item.id}`)}
    />
  );
}
