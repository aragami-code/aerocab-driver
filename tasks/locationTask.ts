import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCATION_TASK_NAME = 'aerocab-driver-location';

const AUTH_STORAGE_KEY = 'aerogo24-driver-auth';
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.aerogo24.com/api';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) return;

  const locations: Location.LocationObject[] = data?.locations ?? [];
  if (!locations.length) return;

  const loc = locations[locations.length - 1];
  const { latitude, longitude } = loc.coords;

  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const token: string | undefined = parsed?.state?.token;
    if (!token) return;

    await fetch(`${API_BASE}/drivers/location`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ latitude, longitude }),
    });
  } catch {
    // silencieux — pas de retry, la prochaine mise à jour arrive dans 30s
  }
});
