import { Redirect, useRouter } from 'expo-router';
import AdminCommandCenter from '../../src/screens/AdminCommandCenter';
import { useAuth } from '../../src/context/AuthContext';

export default function AdminIndexRoute() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!user?.isAdmin) return <Redirect href="/home" />;

  return <AdminCommandCenter onBack={() => router.replace('/home')} />;
}
