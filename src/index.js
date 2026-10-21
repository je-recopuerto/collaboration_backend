import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectDatabase } from './db.js'
import authRoutes from './routes/auth.js'
import blockCompanyRoutes from './routes/blockCompanies.js'
import dailyReportRoutes from './routes/dailyReports.js'
import scheduleRoutes from './routes/schedules.js'
import userRoutes from './routes/users.js'
import dashboardRoutes from './routes/dashboard.js'
import { healUserPermissions } from './utils/healPermissions.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

const corsOptions = {
  origin: '*',
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')))

const PORT = Number(process.env.PORT ?? 4000)
const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI environment variable.')
  process.exit(1)
}

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET environment variable.')
  process.exit(1)
}

try {
  await connectDatabase(MONGODB_URI)
  console.log('Connected to MongoDB')
  await healUserPermissions()
} catch (error) {
  console.error('Failed to connect to MongoDB:', error)
  process.exit(1)
}

app.use('/api/auth', authRoutes)
app.use('/api/block-companies', blockCompanyRoutes)
app.use('/api/daily-reports', dailyReportRoutes)
app.use('/api/schedules', scheduleRoutes)
app.use('/api/users', userRoutes)
app.use('/api/dashboard', dashboardRoutes)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Team backend listening at http://0.0.0.0:${PORT}`)
})
