import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const AVATARS_DIR = path.resolve(__dirname, '../../uploads/avatars')

if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, AVATARS_DIR)
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    const userId = req.auth?.id || 'user'
    cb(null, `${userId}-${Date.now()}${ext}`)
  },
})

function fileFilter(_req, file, cb) {
  if (!file.mimetype?.startsWith('image/')) {
    cb(new Error('Only image files are allowed for avatars.'))
    return
  }
  cb(null, true)
}

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})

export function avatarPublicPath(filename) {
  return `/uploads/avatars/${filename}`
}

export function removeAvatarFile(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== 'string') return
  if (!avatarUrl.startsWith('/uploads/avatars/')) return

  const filename = path.basename(avatarUrl)
  const fullPath = path.join(AVATARS_DIR, filename)
  if (!fullPath.startsWith(AVATARS_DIR)) return

  fs.unlink(fullPath, () => {})
}
