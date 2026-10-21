import { Router } from 'express'
import BlockCompany from '../models/BlockCompany.js'
import DailyReport from '../models/DailyReport.js'
import Schedule from '../models/Schedule.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const MONTH_PATTERN = /^\d{4}-\d{2}$/

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthBounds(year, monthIndex) {
  return {
    start: new Date(year, monthIndex, 1),
    end: new Date(year, monthIndex + 1, 1),
  }
}

function bidValue(value) {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim())
  if (Number.isFinite(parsed) && parsed >= 0) return parsed
  return 1
}

function dayIndex(date, month) {
  if (typeof date !== 'string' || !date.startsWith(`${month}-`)) return -1
  const day = Number(date.slice(8, 10))
  if (!Number.isInteger(day) || day < 1) return -1
  return day - 1
}

function fillDays(items, month, totalDays, readValue) {
  const values = Array.from({ length: totalDays }, () => 0)
  for (const item of items) {
    const index = dayIndex(item.date, month)
    if (index >= 0 && index < totalDays) values[index] += readValue(item)
  }
  return values
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const now = new Date()
    const requested = String(req.query.month || '')
    const month = MONTH_PATTERN.test(requested) ? requested : monthKey(now)
    const [year, monthNumber] = month.split('-').map(Number)
    const monthIndex = monthNumber - 1
    const previous = new Date(year, monthIndex - 1, 1)
    const totalDays = daysInMonth(year, monthIndex)
    const start = `${month}-01`
    const end = `${month}-${String(totalDays).padStart(2, '0')}`
    const previousKey = monthKey(previous)
    const previousDays = daysInMonth(previous.getFullYear(), previous.getMonth())
    const previousStart = `${previousKey}-01`
    const previousEnd = `${previousKey}-${String(previousDays).padStart(2, '0')}`
    const selectedBounds = monthBounds(year, monthIndex)
    const previousBounds = monthBounds(previous.getFullYear(), previous.getMonth())

    const [
      reports,
      schedules,
      previousReports,
      previousSchedules,
      blockCompanies,
      companiesThisMonth,
      companiesLastMonth,
    ] = await Promise.all([
      DailyReport.find({ date: { $gte: start, $lte: end } }).select('date bidNumber'),
      Schedule.find({ date: { $gte: start, $lte: end } }).select('date'),
      DailyReport.find({ date: { $gte: previousStart, $lte: previousEnd } }).select('bidNumber'),
      Schedule.countDocuments({ date: { $gte: previousStart, $lte: previousEnd } }),
      BlockCompany.countDocuments(),
      BlockCompany.countDocuments({
        createdAt: { $gte: selectedBounds.start, $lt: selectedBounds.end },
      }),
      BlockCompany.countDocuments({
        createdAt: { $gte: previousBounds.start, $lt: previousBounds.end },
      }),
    ])

    const bids = fillDays(reports, month, totalDays, (item) => bidValue(item.bidNumber))
    const interviews = fillDays(schedules, month, totalDays, () => 1)
    const previousBidTotal = previousReports.reduce((sum, item) => sum + bidValue(item.bidNumber), 0)
    const bidTotal = bids.reduce((sum, value) => sum + value, 0)
    const interviewTotal = interviews.reduce((sum, value) => sum + value, 0)

    return res.json({
      month,
      days: totalDays,
      bids,
      interviews,
      summary: {
        bids: {
          total: bidTotal,
          delta: bidTotal - previousBidTotal,
        },
        interviews: {
          total: interviewTotal,
          delta: interviewTotal - previousSchedules,
        },
        blockCompanies: {
          total: blockCompanies,
          delta: companiesThisMonth - companiesLastMonth,
        },
      },
    })
  } catch (error) {
    console.error('Failed to load dashboard:', error)
    return res.status(500).json({ message: 'Failed to load dashboard.' })
  }
})

export default router
