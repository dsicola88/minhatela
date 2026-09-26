import { useRouter } from 'expo-router';
import GiftsScreen from '../src/screens/Gifts';

export default function GiftsRoute() {
  const router = useRouter();
  return <GiftsScreen onBack={() => router.back()} />;
}
