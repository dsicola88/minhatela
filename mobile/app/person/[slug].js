import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import Person from '../../src/screens/Person';
import { useAuth } from '../../src/context/AuthContext';

export default function PersonRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { slug } = useLocalSearchParams();

  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <Person
      slug={typeof slug === 'string' ? slug : ''}
      onBack={() => router.back()}
      onSelectTitle={(item) => router.push(`/title/${item.id}`)}
    />
  );
}
