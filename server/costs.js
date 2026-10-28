// Estimated Anthropic cost of logged AI calls.
//
// Prices are US dollars per million tokens, by model (first match wins).
// Prompt-cache writes cost 1.25× the input price and cache reads 0.1×.
// Check https://www.anthropic.com/pricing when models change and update here.
export const PRICES = [
  { label: 'Claude Opus 4 / 4.1',  match: ['%opus-4-0%', '%opus-4-1%', '%opus-4-2025%', '%3-opus%'], input: 15,   output: 75 },
  { label: 'Claude Opus (4.5+)',   match: ['%opus%'],                                                input: 5,    output: 25 },
  { label: 'Claude Haiku 3',       match: ['%3-haiku%'],                                             input: 0.25, output: 1.25 },
  { label: 'Claude Haiku 3.5',     match: ['%3-5-haiku%'],                                           input: 0.8,  output: 4 },
  { label: 'Claude Haiku (4.5+)',  match: ['%haiku%'],                                               input: 1,    output: 5 },
  { label: 'Claude Sonnet',        match: ['%'],                                                     input: 3,    output: 15 },
]
const CACHE_WRITE = 1.25
const CACHE_READ = 0.1

const rateCase = (col, field) => `CASE ${PRICES.map(p =>
  `WHEN ${p.match.map(m => `${col} ILIKE '${m}'`).join(' OR ')} THEN ${p[field]}`).join(' ')} ELSE 3 END`

// SQL for the estimated dollar cost of one token_logs row (table alias `t`)
export const costSql = (t = 'token_logs') => `(
  (${t}.input_tokens + ${t}.cache_write_tokens * ${CACHE_WRITE} + ${t}.cache_read_tokens * ${CACHE_READ}) * ${rateCase(`${t}.model`, 'input')}
  + ${t}.output_tokens * ${rateCase(`${t}.model`, 'output')}
) / 1000000.0`

// Calibration: actual bill ÷ estimate for a period an admin entered; every
// estimate is multiplied by it so totals line up with what Anthropic charges.
export const CALIBRATION_KEY = 'cost_calibration'
export async function calibrationFactor(query) {
  try {
    const r = await query('SELECT value FROM admin_settings WHERE key = $1', [CALIBRATION_KEY])
    const f = Number(r.rows[0]?.value?.factor)
    return Number.isFinite(f) && f > 0 ? f : 1
  } catch { return 1 }
}
