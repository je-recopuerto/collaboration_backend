import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { normalizePermission } from './permissions.js'

const DEFAULT_EXPIRES_IN = '48h'

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable.')
  }
  return secret
}

export function createAuthToken(user) {
  const payload = {
    email: user.email,
    username: user.username,
    permission: normalizePermission(user.permission) ?? user.permission,
  }

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
    subject: String(user.id ?? user._id),
    // Unique per issue so refresh always produces a different token string
    // (JWT iat is only second-precision and can collide).
    jwtid: randomUUID(),
  })
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret())
}
