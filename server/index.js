import 'dotenv/config'
import { readFileSync } from 'fs'
import express from 'express'
import cors from 'cors'

import { pool } from './db.js'
import authRoutes         from './routes/auth.js'
import clientRoutes       from './routes/clients.js'
import slideRoutes        from './routes/slides.js'
import presentationRoutes from './routes/presentations.js'
import templateRoutes     from './routes/templates.js'
import clientDataRoutes   from './routes/clientdata.js'

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))

app.use('/api/auth',          authRoutes)
app.use('/api/clients',       clientRoutes)
app.use('/api/slides',        slideRoutes)
app.use('/api/presentations', presentationRoutes)
app.use('/api/templates',     templateRoutes)
app.use('/api/clientdata',    clientDataRoutes)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Run migrations on every startup (all statements use IF NOT EXISTS — safe to repeat)
async function start() {
  try {
    const sql = readFileSync('./migrations/001_initial.sql', 'utf8')
    await pool.query(sql)
    console.log('Migrations up to date.')
  } catch (err) {
    console.error('Migration error:', err.message)
  }
  app.listen(PORT, () => console.log(`SparkStudio API running on port ${PORT}`))
}

start()
