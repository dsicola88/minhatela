import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import ProfilesScreen from '../src/screens/Profiles';
import { useAuth } from '../src/context/AuthContext';

export default function ProfilesRoute() {
  const router = useRouter();
  const { manage } = useLocalSearchParams();
  const { isAuthenticated, selectProfile } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <ProfilesScreen
      initialManage={manage === '1' || manage === 'true'}
      onSelect={(profile) => {
        selectProfile(profile);
        router.replace('/home');
      }}
    />
  );
}
