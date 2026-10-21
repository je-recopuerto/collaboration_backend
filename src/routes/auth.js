import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { attachFreshAuthUser, requireAuth } from '../middleware/auth.js'
import {
  avatarPublicPath,
  removeAvatarFile,
  uploadAvatar,
} from '../middleware/uploadAvatar.js'
import { createAuthToken } from '../utils/jwt.js'
import { normalizePermission } from '../utils/permissions.js'

const router = Router()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SALT_ROUNDS = 10

function sanitizeUser(user) {
  return {
    id: user.id ?? String(user._id),
    email: user.email,
    username: user.username,
    avatar: user.avatar || '',
    permission: normalizePermission(user.permission) ?? user.permission,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

router.post('/register', async (req, res) => {
  try {
    const { email, username, password, passwordConfirmation } = req.body

    if (!email || !username || !password || !passwordConfirmation) {
      return res.status(400).json({
        message: 'email, username, password, and passwordConfirmation are required.',
      })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedUsername = String(username).trim()

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' })
    }

    if (normalizedUsername.length < 2 || normalizedUsername.length > 40) {
      return res.status(400).json({ message: 'Username must be between 2 and 40 characters.' })
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' })
    }

    if (password !== passwordConfirmation) {
      return res.status(400).json({ message: 'Password confirmation does not match.' })
    }

    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    })

    if (existing) {
      const field = existing.email === normalizedEmail ? 'email' : 'username'
      return res.status(409).json({
        message: `An account with this ${field} already exists.`,
      })
    }

    const hashedPassword = await bcrypt.hash(String(password), SALT_ROUNDS)

    const user = await User.create({
      email: normalizedEmail,
      username: normalizedUsername,
      password: hashedPassword,
      permission: 'unauthorized',
    })

    return res.status(201).json({
      message:
        'Registration successful. An administrator must approve your account before you can sign in.',
      user: sanitizeUser(user),
    })
  } catch (error) {
    console.error('Registration failed:', error)
    return res.status(500).json({ message: 'Registration failed. Please try again.' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required.' })
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password')

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    const matches = await bcrypt.compare(String(password), user.password)
    if (!matches) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    if (normalizePermission(user.permission) === 'unauthorized') {
      return res.status(403).json({
        message:
          'Your account is pending approval. An administrator must grant General User access before you can sign in.',
      })
    }

    const token = createAuthToken(user)

    return res.json({
      message: 'Signed in successfully.',
      token,
      user: sanitizeUser(user),
    })
  } catch (error) {
    console.error('Sign-in failed:', error)
    return res.status(500).json({ message: 'Sign-in failed. Please try again.' })
  }
})

/** Validate session and issue a fresh JWT (used on browser refresh / F5). */
router.get('/me', requireAuth, attachFreshAuthUser, async (req, res) => {
  try {
    const user = req.authUser
    const token = createAuthToken(user)

    return res.json({
      user: sanitizeUser(user),
      token,
    })
  } catch (error) {
    console.error('Failed to refresh session:', error)
    return res.status(500).json({ message: 'Failed to refresh session.' })
  }
})

router.patch(
  '/profile',
  requireAuth,
  attachFreshAuthUser,
  (req, res, next) => {
    uploadAvatar.single('avatar')(req, res, (error) => {
      if (!error) {
        next()
        return
      }

      if (error instanceof Error) {
        const message =
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Avatar must be 5MB or smaller.'
            : error.message || 'Failed to upload avatar.'
        return res.status(400).json({ message })
      }

      return res.status(400).json({ message: 'Failed to upload avatar.' })
    })
  },
  async (req, res) => {
    try {
      const user = req.authUser
      const nextUsername =
        typeof req.body?.username === 'string' ? req.body.username.trim() : user.username

      if (!nextUsername || nextUsername.length < 2 || nextUsername.length > 40) {
        if (req.file) removeAvatarFile(avatarPublicPath(req.file.filename))
        return res.status(400).json({
          message: 'Display name must be between 2 and 40 characters.',
        })
      }

      if (nextUsername !== user.username) {
        const existing = await User.findOne({
          username: nextUsername,
          _id: { $ne: user._id },
        })
        if (existing) {
          if (req.file) removeAvatarFile(avatarPublicPath(req.file.filename))
          return res.status(409).json({ message: 'This display name is already taken.' })
        }
      }

      user.username = nextUsername

      if (req.file) {
        const previousAvatar = user.avatar
        user.avatar = avatarPublicPath(req.file.filename)
        if (previousAvatar && previousAvatar !== user.avatar) {
          removeAvatarFile(previousAvatar)
        }
      }

      await user.save()

      const token = createAuthToken(user)
      return res.json({
        message: 'Profile updated successfully.',
        token,
        user: sanitizeUser(user),
      })
    } catch (error) {
      console.error('Failed to update profile:', error)
      if (req.file) removeAvatarFile(avatarPublicPath(req.file.filename))
      return res.status(500).json({ message: 'Failed to update profile.' })
    }
  },
)

router.patch('/password', requireAuth, attachFreshAuthUser, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: 'currentPassword, newPassword, and confirmPassword are required.',
      })
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' })
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Password confirmation does not match.' })
    }

    const user = await User.findById(req.authUser._id).select('+password')
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const matches = await bcrypt.compare(String(currentPassword), user.password)
    if (!matches) {
      return res.status(401).json({ message: 'Current password is incorrect.' })
    }

    user.password = await bcrypt.hash(String(newPassword), SALT_ROUNDS)
    await user.save()

    return res.json({ message: 'Password updated successfully.' })
  } catch (error) {
    console.error('Failed to update password:', error)
    return res.status(500).json({ message: 'Failed to update password.' })
  }
})

export default router
