import { Redirect, useRouter } from 'expo-router';
import LoginScreen from '../src/screens/Login';
import { useAuth } from '../src/context/AuthContext';

export default function LoginRoute() {
  const router = useRouter();
  const { isAuthenticated, hasProfile, markAuthenticated } = useAuth();

  if (isAuthenticated && hasProfile) {
    return <Redirect href="/home" />;
  }

  if (isAuthenticated && !hasProfile) {
    return <Redirect href="/profiles" />;
  }

  return (
    <LoginScreen
      onForgotPassword={() => router.push('/forgot-password')}
      onOpenLegal={(doc) => router.push(`/legal/${doc}`)}
      onSuccess={async () => {
        await markAuthenticated();
        router.replace('/profiles');
      }}
    />
  );
}
