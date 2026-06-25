// Lightweight markdown-style rich text for bullet points: **bold**, *italic*,
// ***bold italic***. Shared by the editor preview, deck preview, and the
// real pptx exporter so all three render formatting identically.
export function parseRichText(text) {
  if (!text) return [{ text: '', bold: false, italic: false }]
  const tokens = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(t => t !== '')
  if (tokens.length === 0) return [{ text: '', bold: false, italic: false }]
  return tokens.map(t => {
    if (t.startsWith('***') && t.endsWith('***')) return { text: t.slice(3, -3), bold: true, italic: true }
    if (t.startsWith('**') && t.endsWith('**'))   return { text: t.slice(2, -2), bold: true, italic: false }
    if (t.startsWith('*') && t.endsWith('*'))     return { text: t.slice(1, -1), bold: false, italic: true }
    return { text: t, bold: false, italic: false }
  })
}
