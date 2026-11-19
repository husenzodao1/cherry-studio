import { Capacitor } from '@capacitor/core'

import { apiUrl } from './base'

/**
 * The learner's code is shown only after the phone's own lock: fingerprint, face, or the screen PIN,
 * pattern or password (the Android system prompt). A web page cannot reach the phone's lock, so on the
 * website — or on a phone without a screen lock — the login password is checked online instead.
 */
export type Unlock = 'ok' | 'cancelled' | 'password'

export async function unlockWithPhone(title: string, reason: string): Promise<Unlock> {
  if (!Capacitor.isNativePlatform()) return 'password'
  try {
    const { NativeBiometric, BiometryType } = await import('@capgo/capacitor-native-biometric')
    const available = await NativeBiometric.isAvailable({ useFallback: true })
    if (!available.isAvailable) return 'password'
    await NativeBiometric.verifyIdentity({
      title, reason, description: reason, maxAttempts: 5,
      allowedBiometryTypes: [BiometryType.FINGERPRINT, BiometryType.FACE_AUTHENTICATION, BiometryType.IRIS_AUTHENTICATION, BiometryType.DEVICE_CREDENTIAL]
    })
    return 'ok'
  } catch {
    return 'cancelled'
  }
}

/** Checks the login password with the server (wrong tries count towards the usual lock-out). */
export async function checkPassword(username: string, password: string): Promise<'ok' | 'invalid' | 'locked' | 'offline'> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  try {
    const res = await fetch(apiUrl('/profile/login'), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password })
    })
    if (res.ok) return 'ok'
    return res.status === 429 ? 'locked' : res.status === 401 ? 'invalid' : 'offline'
  } catch {
    return 'offline'
  }
}
