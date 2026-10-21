export const USER_PERMISSIONS = ['administrator', 'general', 'unauthorized']

/**
 * Normalize permission strings from JWT, Compass edits, or legacy values.
 * Trims whitespace and maps common aliases to canonical enum values.
 */
export function normalizePermission(value) {
  if (typeof value !== 'string') return null

  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '')

  if (normalized === 'administrator' || normalized === 'admin') {
    return 'administrator'
  }
  if (normalized === 'general' || normalized === 'generaluser') {
    return 'general'
  }
  if (normalized === 'unauthorized') {
    return 'unauthorized'
  }

  return null
}

export function isAdministratorPermission(value) {
  return normalizePermission(value) === 'administrator'
}
