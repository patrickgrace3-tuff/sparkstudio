import React, { useState } from 'react'

const DEFAULT_COLS = 4
const DEFAULT_ROWS = 6

function makeGrid(headers, rows) {
  return { headers, rows }
}

export default function ExcelEditor({ value, onChange }) {
  const initial = value && value.headers
    ? value
    : makeGrid(
        Array.from({ length: DEFAULT_COLS }, (_, i) => `Column ${i + 1}`),
        Array.from({ length: DEFAULT_ROWS }, () => Array(DEFAULT_COLS).fill(''))
      )

  const [headers, setHeaders] = useState(initial.headers)
  const [rows,    setRows]    = useState(initial.rows)

  function update(newHeaders, newRows) {
    setHeaders(newHeaders)
    setRows(newRows)
    onChange({ headers: newHeaders, rows: newRows })
  }

  function setHeader(ci, val) {
    const h = [...headers]; h[ci] = val; update(h, rows)
  }

  function setCell(ri, ci, val) {
    const r = rows.map((row, i) => i === ri ? row.map((c, j) => j === ci ? val : c) : row)
    update(headers, r)
  }

  function addRow() {
    update(headers, [...rows, Array(headers.length).fill('')])
  }

  function addCol() {
    update([...headers, `Column ${headers.length + 1}`], rows.map(r => [...r, '']))
  }

  function removeRow(ri) {
    update(headers, rows.filter((_, i) => i !== ri))
  }

  function removeCol(ci) {
    update(headers.filter((_, i) => i !== ci), rows.map(r => r.filter((_, i) => i !== ci)))
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.cornerTh} />
              {headers.map((h, ci) => (
                <th key={ci} style={styles.th}>
                  <div style={styles.thInner}>
                    <input
                      style={styles.headerInput}
                      value={h}
                      onChange={e => setHeader(ci, e.target.value)}
                    />
                    <button style={styles.removeBtn} onClick={() => removeCol(ci)} title="Remove column">✕</button>
                  </div>
                </th>
              ))}
              <th style={styles.addTh}>
                <button style={styles.addBtn} onClick={addCol}>+ Col</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td style={styles.rowNum}>{ri + 1}</td>
                {row.map((cell, ci) => (
                  <td key={ci} style={styles.td}>
                    <input
                      style={styles.cellInput}
                      value={cell}
                      onChange={e => setCell(ri, ci, e.target.value)}
                    />
                  </td>
                ))}
                <td style={styles.td}>
                  <button style={styles.removeBtn} onClick={() => removeRow(ri)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button style={styles.addRowBtn} onClick={addRow}>+ Add row</button>
    </div>
  )
}

const styles = {
  wrap:        { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  tableWrap:   { flex: 1, overflowAuto: 'auto', overflowX: 'auto', overflowY: 'auto' },
  table:       { borderCollapse: 'collapse', width: '100%', fontSize: 13 },
  cornerTh:    { width: 32, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)' },
  th:          { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', padding: 0, minWidth: 120 },
  thInner:     { display: 'flex', alignItems: 'center' },
  headerInput: { flex: 1, border: 'none', background: 'none', padding: '6px 8px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', outline: 'none', width: '100%' },
  addTh:       { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', padding: '4px 6px', width: 60 },
  td:          { border: '0.5px solid var(--color-border)', padding: 0 },
  rowNum:      { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', padding: '0 8px', fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', width: 32 },
  cellInput:   { border: 'none', background: 'none', padding: '5px 8px', fontSize: 13, color: 'var(--color-text-primary)', outline: 'none', width: '100%', minWidth: 100 },
  removeBtn:   { background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--color-text-muted)', padding: '2px 6px' },
  addBtn:      { background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-secondary)', padding: '2px 4px', whiteSpace: 'nowrap' },
  addRowBtn:   { margin: '8px 0 0', background: 'none', border: '0.5px dashed var(--color-border)', borderRadius: 6, padding: '6px', fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer', width: '100%' },
}