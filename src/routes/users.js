import { Router } from 'express'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { removeAvatarFile } from '../middleware/uploadAvatar.js'
import {
  USER_PERMISSIONS,
  isAdministratorPermission,
  normalizePermission,
} from '../utils/permissions.js'

const router = Router()

function sanitizeManagedUser(user) {
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

async function countAdministrators(excludeId) {
  const filter = { permission: 'administrator' }
  if (excludeId) {
    filter._id = { $ne: excludeId }
  }
  return User.countDocuments(filter)
}

router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 })
    return res.json(users.map(sanitizeManagedUser))
  } catch (error) {
    console.error('Failed to list users:', error)
    return res.status(500).json({ message: 'Failed to load users.' })
  }
})

router.patch('/:id/permission', requireAuth, requireAdmin, async (req, res) => {
  try {
    const nextPermission = normalizePermission(req.body?.permission)
    if (!nextPermission || !USER_PERMISSIONS.includes(nextPermission)) {
      return res.status(400).json({
        message: 'Permission must be Administrator, General User, or Unauthorized.',
      })
    }

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const currentPermission = normalizePermission(user.permission) ?? user.permission
    if (currentPermission === nextPermission) {
      return res.json({
        message: 'Permission unchanged.',
        user: sanitizeManagedUser(user),
      })
    }

    const isSelf = String(user._id) === String(req.authUser._id)
    if (
      isAdministratorPermission(currentPermission) &&
      !isAdministratorPermission(nextPermission)
    ) {
      const remainingAdmins = await countAdministrators(user._id)
      if (remainingAdmins < 1) {
        return res.status(400).json({
          message: 'Cannot remove the last administrator.',
        })
      }
    }

    if (isSelf && !isAdministratorPermission(nextPermission)) {
      return res.status(400).json({
        message: 'You cannot remove your own administrator access.',
      })
    }

    user.permission = nextPermission
    await user.save()

    return res.json({
      message: 'Permission updated successfully.',
      user: sanitizeManagedUser(user),
    })
  } catch (error) {
    console.error('Failed to update user permission:', error)
    return res.status(500).json({ message: 'Failed to update permission.' })
  }
})

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (String(user._id) === String(req.authUser._id)) {
      return res.status(400).json({ message: 'You cannot delete your own account.' })
    }

    if (isAdministratorPermission(user.permission)) {
      const remainingAdmins = await countAdministrators(user._id)
      if (remainingAdmins < 1) {
        return res.status(400).json({
          message: 'Cannot delete the last administrator.',
        })
      }
    }

    await User.findByIdAndDelete(user._id)
    removeAvatarFile(user.avatar)

    return res.json({
      message: 'User deleted successfully.',
      id: String(user._id),
    })
  } catch (error) {
    console.error('Failed to delete user:', error)
    return res.status(500).json({ message: 'Failed to delete user.' })
  }
})

export default router
