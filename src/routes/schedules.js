import { Router } from 'express'
import Schedule from '../models/Schedule.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

function cleanText(value, maxLength = 120) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
}

function isValidTime(value) {
  if (!TIME_PATTERN.test(value)) return false
  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

function parseScheduleBody(body) {
  const date = cleanText(body?.date, 10)
  const startTime = cleanText(body?.startTime, 5)
  const endTime = cleanText(body?.endTime, 5)
  const companyName = cleanText(body?.companyName)
  const category = cleanText(body?.category)
  const interviewLevel = cleanText(body?.interviewLevel)

  if (!date || !isValidDate(date)) {
    return { error: 'Please select a valid date.' }
  }

  if (!startTime || !isValidTime(startTime)) {
    return { error: 'Please select a valid start time.' }
  }

  if (!endTime || !isValidTime(endTime)) {
    return { error: 'Please select a valid end time.' }
  }

  if (startTime >= endTime) {
    return { error: 'End time must be after start time.' }
  }

  if (!companyName) {
    return { error: 'Company name is required.' }
  }

  if (!category) {
    return { error: 'Category is required.' }
  }

  if (!interviewLevel) {
    return { error: 'Interview level/grade is required.' }
  }

  return {
    data: {
      date,
      startTime,
      endTime,
      companyName,
      category,
      interviewLevel,
    },
  }
}

function timesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA
}

async function findOverlappingSchedule(date, startTime, endTime, excludeId) {
  const sameDay = await Schedule.find({ date }).select('startTime endTime')
  return sameDay.find(
    (item) =>
      String(item._id) !== String(excludeId || '') &&
      timesOverlap(startTime, endTime, item.startTime, item.endTime),
  )
}

router.get('/', requireAuth, async (_req, res) => {
  try {
    const items = await Schedule.find().sort({ date: -1, startTime: 1, createdAt: -1 })
    return res.json(items)
  } catch (error) {
    console.error('Failed to list schedules:', error)
    return res.status(500).json({ message: 'Failed to load schedules.' })
  }
})

router.post('/', requireAuth, async (req, res) => {
  try {
    const parsed = parseScheduleBody(req.body)
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error })
    }

    const overlap = await findOverlappingSchedule(
      parsed.data.date,
      parsed.data.startTime,
      parsed.data.endTime,
    )
    if (overlap) {
      return res.status(409).json({
        message: 'This time slot is already booked.',
      })
    }

    const item = await Schedule.create(parsed.data)
    return res.status(201).json(item)
  } catch (error) {
    console.error('Failed to create schedule:', error)
    return res.status(500).json({ message: 'Failed to save schedule.' })
  }
})

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const parsed = parseScheduleBody(req.body)
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error })
    }

    const overlap = await findOverlappingSchedule(
      parsed.data.date,
      parsed.data.startTime,
      parsed.data.endTime,
      req.params.id,
    )
    if (overlap) {
      return res.status(409).json({
        message: 'This time slot is already booked.',
      })
    }

    const item = await Schedule.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true,
      runValidators: true,
    })

    if (!item) {
      return res.status(404).json({ message: 'Schedule not found.' })
    }

    return res.json(item)
  } catch (error) {
    console.error('Failed to update schedule:', error)
    return res.status(500).json({ message: 'Failed to update schedule.' })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await Schedule.findByIdAndDelete(req.params.id)

    if (!deleted) {
      return res.status(404).json({ message: 'Schedule not found.' })
    }

    return res.json({ message: 'Deleted successfully.', id: String(deleted._id) })
  } catch (error) {
    console.error('Failed to delete schedule:', error)
    return res.status(500).json({ message: 'Failed to delete schedule.' })
  }
})

export default router
