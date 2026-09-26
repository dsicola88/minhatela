import { useRouter } from 'expo-router';
import ForgotPasswordScreen from '../src/screens/ForgotPassword';

export default function ForgotPasswordRoute() {
  const router = useRouter();

  return (
    <ForgotPasswordScreen
      onBack={() => router.replace('/login')}
      onDevToken={(result) => {
        if (result?.devResetToken) {
          router.push({
            pathname: '/reset-password',
            params: { token: result.devResetToken },
          });
        }
      }}
    />
  );
}
