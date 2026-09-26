import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { colors } from '../src/theme/tokens';

export default function Index() {
  const { ready, isAuthenticated, hasProfile } = useAuth();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.black,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.red} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (!hasProfile) {
    return <Redirect href="/profiles" />;
  }

  return <Redirect href="/home" />;
}
