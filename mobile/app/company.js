import { Redirect, useRouter } from 'expo-router';
import CompanyPortal from '../src/screens/CompanyPortal';
import { useAuth } from '../src/context/AuthContext';

export default function CompanyRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return <CompanyPortal onBack={() => router.replace('/creator-studio')} />;
}
