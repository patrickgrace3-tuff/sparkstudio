import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import authRoutes         from './routes/auth.js'
import clientRoutes       from './routes/clients.js'
import slideRoutes        from './routes/slides.js'
import presentationRoutes from './routes/presentations.js'
import templateRoutes     from './routes/templates.js'

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

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log(`SparkStudio API running on port ${PORT}`))
