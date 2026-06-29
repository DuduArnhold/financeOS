// src/lib/haptic.ts
// Haptic feedback service — graceful degradation silenciosa.
// No futuro: integração com PWA Vibration API, Capacitor, React Native.

const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator

export const haptic = {
  success: () => { if (isSupported) navigator.vibrate(10) },
  error:   () => { if (isSupported) navigator.vibrate([20, 50, 20]) },
  warning: () => { if (isSupported) navigator.vibrate(15) },
  light:   () => { if (isSupported) navigator.vibrate(5) },
}
