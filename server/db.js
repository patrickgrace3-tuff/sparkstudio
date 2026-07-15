import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
})

pool.on('error', (err) => {
  console.error('Postgres pool error:', err)
})

export async function query(text, params) {
  const res = await pool.query(text, params)
  return res
}
