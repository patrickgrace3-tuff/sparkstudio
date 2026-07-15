import { readFileSync } from 'fs'
import { pool } from './db.js'

const sql = readFileSync('./migrations/001_initial.sql', 'utf8')

try {
  await pool.query(sql)
  console.log('Migration complete.')
} catch (err) {
  console.error('Migration failed:', err.message)
} finally {
  await pool.end()
}
