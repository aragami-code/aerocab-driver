import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

export default function Index() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (!token || !user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(tabs)" />;
}
