import { Redirect, useRouter } from 'expo-router';
import AccountScreen from '../src/screens/Account';
import { useAuth } from '../src/context/AuthContext';

export default function AccountRoute() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <AccountScreen
      onBack={() => router.back()}
      onSwitchProfiles={() => router.push('/profiles')}
      onManageProfiles={() => router.push('/profiles?manage=1')}
      onHistory={() => router.push('/history')}
      onPayments={() => router.push('/payments')}
      onNotifications={() => router.push('/notifications')}
      onMyList={() => router.push('/my-list')}
      onDownloads={() => router.push('/downloads')}
      onPlans={() => router.push('/plans')}
      onLegal={(doc) => router.push(`/legal/${doc}`)}
      onHelp={() => router.push('/help')}
      onGifts={() => router.push('/gifts')}
      onPremieres={() => router.push('/premieres')}
      onForYou={() => router.push('/for-you')}
      onNetwork={() => router.push('/network')}
      onLanguages={() => router.push('/languages')}
      onInvoices={() => router.push('/invoices')}
      onLogout={async () => {
        await logout();
        router.replace('/login');
      }}
    />
  );
}
