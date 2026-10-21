import { Router } from 'express'
import BlockCompany from '../models/BlockCompany.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function isValidUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeUrl(value) {
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

router.get('/', requireAuth, async (_req, res) => {
  try {
    const items = await BlockCompany.find().sort({ createdAt: -1 })
    return res.json(items)
  } catch (error) {
    console.error('Failed to list block companies:', error)
    return res.status(500).json({ message: 'Failed to load block companies.' })
  }
})

router.post('/', requireAuth, async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const url = normalizeUrl(req.body?.url ?? '')

    if (!name) {
      return res.status(400).json({ message: 'Block Company name is required.' })
    }

    if (!url) {
      return res.status(400).json({ message: 'URL is required.' })
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({ message: 'Please enter a valid URL.' })
    }

    const item = await BlockCompany.create({ name, url })
    return res.status(201).json(item)
  } catch (error) {
    console.error('Failed to create block company:', error)
    return res.status(500).json({ message: 'Failed to save block company.' })
  }
})

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const url = normalizeUrl(req.body?.url ?? '')

    if (!name) {
      return res.status(400).json({ message: 'Block Company name is required.' })
    }

    if (!url) {
      return res.status(400).json({ message: 'URL is required.' })
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({ message: 'Please enter a valid URL.' })
    }

    const item = await BlockCompany.findByIdAndUpdate(
      req.params.id,
      { name, url },
      { new: true, runValidators: true },
    )

    if (!item) {
      return res.status(404).json({ message: 'Block company not found.' })
    }

    return res.json(item)
  } catch (error) {
    console.error('Failed to update block company:', error)
    return res.status(500).json({ message: 'Failed to update block company.' })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await BlockCompany.findByIdAndDelete(req.params.id)

    if (!deleted) {
      return res.status(404).json({ message: 'Block company not found.' })
    }

    return res.json({ message: 'Deleted successfully.', id: String(deleted._id) })
  } catch (error) {
    console.error('Failed to delete block company:', error)
    return res.status(500).json({ message: 'Failed to delete block company.' })
  }
})

export default router
