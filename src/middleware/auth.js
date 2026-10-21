import User from '../models/User.js'
import { verifyAuthToken } from '../utils/jwt.js'
import { normalizePermission } from '../utils/permissions.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  try {
    const payload = verifyAuthToken(token)
    req.auth = {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      permission: normalizePermission(payload.permission) ?? payload.permission,
    }
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

async function resolveAuthUser(req) {
  if (!req.auth?.id) {
    return { error: { status: 401, message: 'Authentication required.' } }
  }

  const user = await User.findById(req.auth.id)
  if (!user) {
    return { error: { status: 401, message: 'Account no longer exists.' } }
  }

  const permission = normalizePermission(user.permission) ?? user.permission

  if (permission && permission !== user.permission) {
    await User.collection.updateOne({ _id: user._id }, { $set: { permission } })
    user.permission = permission
  }

  if (permission === 'unauthorized') {
    return { error: { status: 403, message: 'Your account is pending approval.' } }
  }

  return { user, permission }
}

/** Resolve permission from MongoDB (source of truth), not only the JWT claim. */
export async function attachFreshAuthUser(req, res, next) {
  try {
    const result = await resolveAuthUser(req)
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message })
    }

    req.authUser = result.user
    req.auth = {
      id: String(result.user._id),
      email: result.user.email,
      username: result.user.username,
      permission: result.permission,
    }
    return next()
  } catch (error) {
    console.error('Failed to resolve auth user:', error)
    return res.status(500).json({ message: 'Failed to verify account permissions.' })
  }
}
