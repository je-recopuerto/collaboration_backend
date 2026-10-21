import { isAdministratorPermission } from '../utils/permissions.js'
import { attachFreshAuthUser } from './auth.js'

/** Ensure the authenticated user is an administrator (DB permission is source of truth). */
export async function requireAdmin(req, res, next) {
  return attachFreshAuthUser(req, res, () => {
    if (!isAdministratorPermission(req.auth?.permission)) {
      return res.status(403).json({ message: 'Administrator access required.' })
    }
    return next()
  })
}
