import { useRouter } from 'expo-router';
import { Redirect } from 'expo-router';
import SearchScreen from '../src/screens/Search';
import { useAuth } from '../src/context/AuthContext';

export default function SearchRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <SearchScreen
      onBack={() => router.back()}
      onSelect={(item) => router.push(`/watch/${item.id}`)}
    />
  );
}
