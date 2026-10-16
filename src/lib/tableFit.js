// "Show all rows" table setting (slide.style.tableShowAll). Off: previews show
// the first few rows plus "+N more rows". On: every row is shown and the text
// shrinks so the whole table fits its box — in previews and the exported pptx.

const SLIDE_H_CQW = 56.25 // 16:9 slide height in container-width units
// Previews pin the table's line height so every view sizes rows the same:
// row ≈ line height + 0.6em cell padding + borders, with a little slack
export const TABLE_LINE_HEIGHT = 1.2
const ROW_EM = TABLE_LINE_HEIGHT + 0.6 + 0.15

export const DEFAULT_TABLE_BOX = { x: 0.045, y: 0.55, w: 0.829, h: 0.32 }

// Rows to render and the font size (cqw) for an HTML table preview
export function previewTable(table, style = {}, previewLimit = 6, baseFontCqw = 1.2) {
  const rows = table?.rows ?? []
  if (!style.tableShowAll) {
    return { rows: rows.slice(0, previewLimit), hidden: Math.max(0, rows.length - previewLimit), fontCqw: baseFontCqw, showAll: false }
  }
  const box = style.tableBox ?? DEFAULT_TABLE_BOX
  const fit = (box.h * SLIDE_H_CQW) / ((rows.length + 1) * ROW_EM)
  return { rows, hidden: 0, fontCqw: Math.max(0.4, Math.min(baseFontCqw, fit)), showAll: true }
}

// Row heights and font size (hundredths of a point) so all rows fit the box
// height in the exported pptx. boxHeightEmu = table box height in EMU.
export function exportTableMetrics(rowCount, boxHeightEmu) {
  const rowH = Math.floor(boxHeightEmu / (rowCount + 1))
  const pt   = Math.max(6, Math.min(12, Math.round((rowH / 12700) * 0.6)))
  return { headerH: rowH, rowH, sz: pt * 100 }
}
