import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';

// Checks EAS Update when the app opens (and when it comes back after a while): if a newer
// version was published for this build's runtime, download it and restart into it.
const RESUME_INTERVAL_MS = 15 * 60 * 1000;

async function applyLatestUpdate() {
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    // No internet or update service unavailable: keep running the current version.
  }
}

export function useAppUpdates() {
  useEffect(() => {
    // Not available on web, in development or in Expo Go.
    if (Platform.OS === 'web' || __DEV__ || !Updates.isEnabled) return;
    let lastCheck = Date.now();
    void applyLatestUpdate();
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' || Date.now() - lastCheck < RESUME_INTERVAL_MS) return;
      lastCheck = Date.now();
      void applyLatestUpdate();
    });
    return () => subscription.remove();
  }, []);
}
