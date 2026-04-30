import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';

export default function Index() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/chat" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
