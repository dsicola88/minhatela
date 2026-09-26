import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

/** Compat: redirecciona para Command Center unificado */
export default function AdminContentCompat() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!user?.isAdmin) return <Redirect href="/home" />;
  return <Redirect href="/admin" />;
}
