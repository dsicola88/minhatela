import { useLocalSearchParams, useRouter } from 'expo-router';
import LegalDocument from '../../src/screens/LegalDocument';

export default function LegalRoute() {
  const router = useRouter();
  const { doc } = useLocalSearchParams();
  const docType = doc === 'privacy' ? 'privacy' : 'terms';

  return <LegalDocument docType={docType} onBack={() => router.back()} />;
}
