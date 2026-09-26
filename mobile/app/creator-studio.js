import { useRouter } from 'expo-router';
import CreatorStudioScreen from '../src/screens/CreatorStudio';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function CreatorStudioRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return <CreatorStudioScreen onBack={() => router.replace('/home')} />;
}
