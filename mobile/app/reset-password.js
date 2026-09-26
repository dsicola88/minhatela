import { useLocalSearchParams, useRouter } from 'expo-router';
import ResetPasswordScreen from '../src/screens/ResetPassword';

export default function ResetPasswordRoute() {
  const router = useRouter();
  const { token } = useLocalSearchParams();

  return (
    <ResetPasswordScreen
      token={token}
      onBack={() => router.replace('/login')}
      onSuccess={() => router.replace('/login')}
    />
  );
}
