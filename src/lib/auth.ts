/**
 * Authentication state management for SPA.
 *
 * Provides:
 * - Async auth checking against /auth/me
 * - Sync accessors for current user state
 * - Role-based permission checking
 */

export interface AuthUser {
  id: number
  username: string
  role: 'viewer' | 'publisher' | 'admin'
}

let currentUser: AuthUser | null = null
let authPromise: Promise<AuthUser | null> | null = null
let authChecked = false

/**
 * Check authentication status by calling /auth/me.
 * Caches the result for subsequent sync access.
 */
export async function checkAuth(): Promise<AuthUser | null> {
  // Return cached result if already checked
  if (authPromise) {
    return authPromise
  }

  authPromise = (async () => {
    try {
      const res = await fetch('/auth/me', {
        credentials: 'same-origin',
      })
      if (res.ok) {
        currentUser = await res.json()
        authChecked = true
        return currentUser
      }
    } catch {
      // Auth endpoint not available or network error
    }
    currentUser = null
    authChecked = true
    return null
  })()

  return authPromise
}

/**
 * Reset auth state and re-check.
 * Call after login/logout.
 */
export async function refreshAuth(): Promise<AuthUser | null> {
  currentUser = null
  authPromise = null
  authChecked = false
  return checkAuth()
}

/**
 * Get the current user synchronously.
 * Returns null if not logged in or auth not checked yet.
 */
export function getUser(): AuthUser | null {
  return currentUser
}

/**
 * Check if user is currently logged in.
 */
export function isLoggedIn(): boolean {
  return currentUser !== null
}

/**
 * Check if auth has been verified.
 */
export function isAuthChecked(): boolean {
  return authChecked
}

/**
 * Check if the current user has a specific role or higher.
 * Role hierarchy: viewer < publisher < admin
 */
export function hasRole(role: 'viewer' | 'publisher' | 'admin'): boolean {
  if (!currentUser) return false

  const levels: Record<string, number> = {
    viewer: 0,
    publisher: 1,
    admin: 2,
  }

  const userLevel = levels[currentUser.role] ?? 0
  const requiredLevel = levels[role] ?? 0

  return userLevel >= requiredLevel
}

/**
 * Check if current user is an admin.
 */
export function isAdmin(): boolean {
  return currentUser?.role === 'admin'
}

/**
 * Check if current user can publish streams.
 */
export function canPublish(): boolean {
  return hasRole('publisher')
}

/**
 * Logout the current user and redirect to login.
 */
export async function logout(redirectTo = '/login'): Promise<void> {
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    })
  } catch {
    // Ignore errors - proceed with client-side cleanup
  }

  currentUser = null
  authPromise = null
  authChecked = false

  window.location.href = redirectTo
}
