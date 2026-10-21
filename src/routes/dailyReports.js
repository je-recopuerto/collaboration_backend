import { Router } from 'express'
import mongoose from 'mongoose'
import DailyReport from '../models/DailyReport.js'
import User from '../models/User.js'
import { attachFreshAuthUser, requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

const router = Router()

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function cleanText(value, maxLength = 120) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
}

function parseBody(body) {
  const date = cleanText(body?.date, 10)
  const bidNumber = cleanText(body?.bidNumber, 120)
  const other = cleanText(body?.other, 5000)

  if (!date || !isValidDate(date)) {
    return { error: 'Please select a valid date.' }
  }

  if (!bidNumber) {
    return { error: 'BID number is required.' }
  }

  if (!other) {
    return { error: 'OTHER field is required.' }
  }

  return {
    data: {
      date,
      bidNumber,
      other,
    },
  }
}

async function findReportForDate(date, excludeId) {
  const filter = { date }
  if (excludeId) filter._id = { $ne: excludeId }
  return DailyReport.findOne(filter).select('_id')
}

function toPlainReport(item) {
  if (!item) return null
  if (typeof item.toJSON === 'function') return item.toJSON()
  return item
}

async function withAuthor(items) {
  const list = (Array.isArray(items) ? items : [items]).filter(Boolean).map(toPlainReport)
  const userIds = [
    ...new Set(
      list
        .map((item) => String(item.userId || ''))
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    ),
  ]

  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('username avatar')
    : []

  const userMap = new Map(users.map((user) => [String(user._id), user]))

  return list.map((item) => {
    const author = userMap.get(String(item.userId || ''))
    return {
      ...item,
      userId: item.userId || '',
      username: author?.username || item.username || '',
      avatar: author?.avatar || '',
    }
  })
}

router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const items = await DailyReport.find().sort({ date: -1, createdAt: -1 })
    return res.json(await withAuthor(items))
  } catch (error) {
    console.error('Failed to list daily reports:', error)
    return res.status(500).json({ message: 'Failed to load daily reports.' })
  }
})

router.post('/', requireAuth, requireAdmin, attachFreshAuthUser, async (req, res) => {
  try {
    const parsed = parseBody(req.body)
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error })
    }

    const username = cleanText(req.authUser?.username, 40)
    const userId = String(req.authUser?._id || '')
    if (!username || !userId) {
      return res.status(400).json({ message: 'Authenticated user is required.' })
    }

    const existingForDate = await findReportForDate(parsed.data.date)
    if (existingForDate) {
      return res.status(409).json({
        message: 'A daily report has already been submitted for this date.',
      })
    }

    const item = await DailyReport.create({
      ...parsed.data,
      username,
      userId,
    })

    const [enriched] = await withAuthor([item])
    return res.status(201).json(enriched)
  } catch (error) {
    console.error('Failed to create daily report:', error)
    return res.status(500).json({ message: 'Failed to save daily report.' })
  }
})

router.patch('/:id', requireAuth, requireAdmin, attachFreshAuthUser, async (req, res) => {
  try {
    const parsed = parseBody(req.body)
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error })
    }

    const existing = await DailyReport.findById(req.params.id)
    if (!existing) {
      return res.status(404).json({ message: 'Daily report not found.' })
    }

    const existingForDate = await findReportForDate(parsed.data.date, existing._id)
    if (existingForDate) {
      return res.status(409).json({
        message: 'A daily report has already been submitted for this date.',
      })
    }

    existing.date = parsed.data.date
    existing.bidNumber = parsed.data.bidNumber
    existing.other = parsed.data.other

    // Backfill author fields for older reports that were saved without them.
    if (!existing.userId) {
      existing.userId = String(req.authUser._id)
      existing.username = req.authUser.username
    }

    await existing.save()

    const [enriched] = await withAuthor([existing])
    return res.json(enriched)
  } catch (error) {
    console.error('Failed to update daily report:', error)
    return res.status(500).json({ message: 'Failed to update daily report.' })
  }
})

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await DailyReport.findByIdAndDelete(req.params.id)

    if (!deleted) {
      return res.status(404).json({ message: 'Daily report not found.' })
    }

    return res.json({ message: 'Deleted successfully.', id: String(deleted._id) })
  } catch (error) {
    console.error('Failed to delete daily report:', error)
    return res.status(500).json({ message: 'Failed to delete daily report.' })
  }
})

export default router
