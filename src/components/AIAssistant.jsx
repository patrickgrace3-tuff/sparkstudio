import React, { useState, useRef, useEffect } from 'react'
import { loadFiles, loadGlobalFiles, buildAIContext } from '../lib/files.js'
import { callClaude } from '../lib/api.js'
import { api } from '../lib/apiClient.js'

function getSuggestions(clientName) {
  const c = clientName || 'this client'
  return [
    `Summarise the key data from my files specific to ${c}`,
    `Create a slide with the top highlights for ${c} from this department`,
    `Based on the survey or uploaded docs, what should we prioritise for ${c}?`,
    `Pull the most important metrics for ${c} and turn them into a slide`,
  ]
}

export default function AIAssistant({ clientId, clientName, deptId, deptName, deptColor, allSlides, currentUser, totalSlides, onAddSlide }) {
  const [messages,       setMessages]       = useState([])
  const [input,          setInput]          = useState('')
  const [loading,        setLoading]        = useState(false)
  const [selectedImages, setSelectedImages] = useState([])
  const [showFiles,      setShowFiles]      = useState(false)
  const [excludedFiles,  setExcludedFiles]  = useState(new Set())
  const [slideLimit,     setSlideLimit]     = useState(null)   // null = loading
  const [requestStatus,  setRequestStatus]  = useState(null)   // null | 'pending' | 'sent' | 'error'
  const [requestNote,    setRequestNote]    = useState('')
  const [showRequestForm, setShowRequestForm] = useState(false)
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  const isAdmin = currentUser?.role === 'admin'

  // Fetch the user's current slide limit for this client
  useEffect(() => {
    if (!clientId || isAdmin) { setSlideLimit({ limit: -1, isAdmin: true }); return }
    api.getMySlideLimit(clientId)
      .then(setSlideLimit)
      .catch(() => setSlideLimit({ limit: 5, isAdmin: false }))
  }, [clientId, isAdmin])

  const effectiveLimit = isAdmin ? -1 : (slideLimit?.limit ?? 5)
  const atLimit        = !isAdmin && effectiveLimit >= 0 && (totalSlides ?? 0) >= effectiveLimit

  async function handleRequestMore() {
    setRequestStatus('pending')
    try {
      await api.requestMoreSlides(clientId, 10, requestNote)
      setRequestStatus('sent')
      setShowRequestForm(false)
    } catch (e) {
      if (e.message?.includes('already have a pending')) setRequestStatus('already_pending')
      else setRequestStatus('error')
    }
  }

  // All available files (dept + global) for the checkbox panel
  function getAllFiles() {
    const fileData   = loadFiles(clientId, deptId)
    const globalData = loadGlobalFiles(clientId)
    return [
      ...globalData.files.map(f => ({ ...f, _global: true })),
      ...fileData.files.map(f => ({ ...f, _global: false })),
    ]
  }

  function toggleFile(name) {
    setExcludedFiles(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Collect image files from dept + global
  function getAvailableImages() {
    const fileData   = loadFiles(clientId, deptId)
    const globalData = loadGlobalFiles(clientId)
    const all = [...(globalData.files ?? []), ...(fileData.files ?? [])]
    return all.filter(f => {
      const ext  = f.name.split('.').pop().toLowerCase()
      const mime = f.content?.mimeType ?? ''
      return mime.startsWith('image/') || ['png','jpg','jpeg','gif','webp'].includes(ext)
    }).map(f => {
      const raw  = f.content?.base64 ?? ''
      const b64  = raw.includes(',') ? raw.split(',')[1] : raw
      const ext  = f.name.split('.').pop().toLowerCase()
      const mime = f.content?.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`
      return { name: f.name, base64: b64, mimeType: mime, dataUrl: raw.startsWith('data:') ? raw : `data:${mime};base64,${b64}` }
    })
  }

  function toggleImage(img) {
    setSelectedImages(prev =>
      prev.find(i => i.name === img.name)
        ? prev.filter(i => i.name !== img.name)
        : [...prev, img]
    )
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const pdfFilesRef = useRef([])

  // Build system prompt + collect PDF files for document blocks
  function buildContext() {
    const fileData   = loadFiles(clientId, deptId)
    const globalData = loadGlobalFiles(clientId)

    // Filter out excluded files before building AI context
    const filteredFileData   = { ...fileData,   files: fileData.files.filter(f   => !excludedFiles.has(f.name)) }
    const filteredGlobalData = { ...globalData, files: globalData.files.filter(f => !excludedFiles.has(f.name)) }

    const { textSummary, pdfFiles } = buildAIContext(filteredFileData, deptName, filteredGlobalData)
    pdfFilesRef.current = pdfFiles

    const globalFiles = filteredGlobalData.files.map(f => {
      const isPdf = f.name.toLowerCase().endsWith('.pdf') || (f.content?.mimeType ?? '').includes('pdf')
      return `  - "${f.name}" [GLOBAL]${isPdf ? ' (PDF, read natively)' : ''}${f.type === 'link' ? ' (linked file)' : ''}`
    })
    const deptFiles = filteredFileData.files.map(f => {
      const isPdf = f.name.toLowerCase().endsWith('.pdf') || (f.content?.mimeType ?? '').includes('pdf')
      return `  - "${f.name}"${isPdf ? ' (PDF, read natively)' : ''}${f.type === 'link' ? ' (linked file)' : ''}`
    })
    const fileInventory = [...globalFiles, ...deptFiles].join('\n') || '  (none)'

    const existingSlides = (allSlides[deptId] || [])
      .map((s, i) => `  Slide ${i + 1}: ${s.title} — ${s.body}`)
      .join('\n')

    return `
You are an AI assistant helping the ${deptName} department build a presentation for:

CLIENT: ${clientName}

This is critical — every slide you suggest must be specifically relevant to ${clientName}.
When reading file data (CSVs, spreadsheets, reports), filter and highlight only the rows,
metrics, and information that relate to ${clientName}. Do not create generic slides.
If a file contains data for many clients, find ${clientName}'s specific rows and use
those numbers. If a pre-meeting survey is provided, use ${clientName}'s stated priorities
to drive what topics to cover.
You have FULL ACCESS to all department files below. PDFs are attached as documents
you can read directly. CSVs, spreadsheets and Word docs are included as text.
Do NOT say you cannot access the files — you already have their full content.

STRICT RULES — follow every one without exception:

1. ALWAYS include at least one slide block in every response. Never reply with text only.
2. NEVER use markdown formatting — no **, no ##, no *, no _underscores_, no backticks. Plain English only.
3. Keep any conversational text to 1-2 short plain sentences before the slide. No walls of text.
4. Slides must be executive-ready and presentation-worthy. Do not dump raw data.
   Interpret the numbers. Lead with the insight. Tell a story a presenter would be proud of.
5. Each bullet = one clear, punchy idea written as a presenter would say it out loud.
   Good: "21% assisted hire rate signals a major lead conversion opportunity"
   Bad: "Assisted Hire Rate: 21% (below industry average compared to other clients)"
6. Use specific numbers and names from the files — but frame them as insights, not lists.

Slide format — use EXACTLY this every time:

SLIDE_START
TITLE: Compelling title that tells the story
BULLETS:
- Insight-driven point in plain English, specific to the client
- Clear and punchy — no markdown, no fluff
- Action-oriented or data-backed conclusion
IMAGE: filename.png
PLACEMENT: bottom
TABLE (only include if the user asks for a table or data grid):
Month | Metric | Value
Jan 2026 | Assisted Hires | 3
Jan 2026 | Total Hires | 14
SLIDE_END

IMAGE and PLACEMENT rules:
- If an image was attached to this conversation and it is relevant to the slide, include IMAGE: <exact filename> and PLACEMENT: bottom or right
- "bottom" = image spans full width below bullets (best for charts, graphs, data visuals — use by default)
- "right" = image on right side, text on left (best for product photos or portraits)
- Omit IMAGE and PLACEMENT lines entirely if no image was attached or if it doesn't fit the slide
If the user asks for a table, replace the TABLE example rows with real data from the files.
The first TABLE row is always headers. Use pipe | to separate columns.
You can include BULLETS, IMAGE, and TABLE in the same slide, or just some of them.

--- Files available (${fileData.files.length} total) ---
${fileInventory}

--- Text file content ---
${textSummary || 'No text-readable files. PDF content is attached as documents below.'}

--- Existing slides already added ---
${existingSlides || 'No slides added yet.'}
    `.trim()
  }

  async function sendMessage(text) {
    const userText = text ?? input.trim()
    if (!userText || loading) return
    setInput('')
    const attachedImages = [...selectedImages]
    setSelectedImages([])

    const userMsg = { role: 'user', text: userText, images: attachedImages.map(i => i.name) }
    const history = [...messages, userMsg]
    setMessages(history)
    setLoading(true)

    try {
      // Build system prompt (also populates pdfFilesRef)
      const system = buildContext()
      const pdfs   = pdfFilesRef.current

      // Build conversation — inject PDF + image blocks into the FIRST user message
      const convo = history.map((m, idx) => {
        if (m.role !== 'user') return { role: 'assistant', content: m.text }

        const extraBlocks = []

        // Attach PDFs only on the first user message
        if (idx === 0 && pdfs.length > 0) {
          pdfs.forEach(pdf => extraBlocks.push({
            type:   'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdf.base64 },
            title:  pdf.name,
          }))
        }

        // Attach selected images on this specific message
        if (idx === history.length - 1 && attachedImages.length > 0) {
          attachedImages.forEach(img => extraBlocks.push({
            type:   'image',
            source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
          }))
        }

        if (extraBlocks.length > 0) {
          return { role: 'user', content: [...extraBlocks, { type: 'text', text: m.text }] }
        }
        return { role: 'user', content: m.text }
      })

      const { ANTHROPIC_MODEL } = await import('../lib/constants.js')
      const data = await api.callClaude({
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        system,
        messages: convo,
        clientId,
      })
      const reply = data.content?.map(b => b.text ?? '').join('') ?? ''

      // Build image map so parseSlides can resolve base64
      const imageMap = Object.fromEntries(attachedImages.map(i => [i.name, i]))

      // Parse out any slide blocks
      let slides  = parseSlides(reply, imageMap)
      const stripped = reply.replace(/SLIDE_START[\s\S]*?SLIDE_END/g, '').trim()
      // Strip any markdown the AI used despite instructions
      const cleaned = stripped
        .replace(/\*\*([^*]+)\*\*/g, '$1')   // **bold**
        .replace(/\*([^*]+)\*/g, '$1')         // *italic*
        .replace(/^#{1,3}\s+/gm, '')            // ## headings
        .replace(/__([^_]+)__/g, '$1')           // __bold__
        .replace(/`([^`]+)`/g, '$1')             // `code`
        .trim()

      // Last resort — if still no slides, ask Claude to reformat
      if (slides.length === 0 && cleaned.length > 50) {
        try {
          const reformatData = await api.callClaude({
            model: ANTHROPIC_MODEL,
            max_tokens: 600,
            messages: [{
              role: 'user',
              content: 'Convert this response into a slide using EXACTLY this format and nothing else:\n\nSLIDE_START\nTITLE: <title>\nBULLETS:\n- <bullet>\n- <bullet>\n- <bullet>\nSLIDE_END\n\nResponse to convert:\n' + cleaned.slice(0, 1000)
            }],
            clientId,
          })
          const reformatText = reformatData.content?.map(b => b.text ?? '').join('') ?? ''
          slides = parseSlides(reformatText, imageMap)
        } catch { /* silent — original response still shown */ }
      }

      const assistantMsg = { role: 'assistant', text: cleaned, slides }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Sorry, something went wrong: ${err.message}`, slides: [] }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function stripMd(s) {
    return s
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^#{1,3}\s+/gm, '')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .trim()
  }

  function parseTable(block) {
    // Find TABLE section — lines after TABLE keyword until end of block
    const tableMatch = block.match(/TABLE[^\n]*\n([\s\S]+)$/)
    if (!tableMatch) return null
    const rows = tableMatch[1]
      .split('\n')
      .map(r => r.trim())
      .filter(r => r && r.includes('|'))
      .map(r => r.split('|').map(c => c.trim()).filter(c => c !== ''))
    if (rows.length < 2) return null
    return { headers: rows[0], rows: rows.slice(1) }
  }

  function parseSlides(text, imageMap = {}) {
    // Default bodyBox matches PreviewPanel default
    const DEFAULT_BOX = { x: 0.045, y: 0.19, w: 0.829, h: 0.63 }
    const GAP = 0.015

    function applyImagePlacement(imgName, placement, imageMap) {
      const img = imageMap[imgName]
      if (!img) return {}
      const src = `data:${img.mimeType};base64,${img.base64}`
      let imgRect, adjustedBox
      if (placement === 'bottom') {
        imgRect      = { x: 0.045, y: 0.50, w: 0.78, h: 0.38 }
        adjustedBox  = { ...DEFAULT_BOX, h: 0.28 }
      } else {
        imgRect      = { x: 0.575, y: 0.19, w: 0.35, h: 0.60 }
        adjustedBox  = { ...DEFAULT_BOX, w: imgRect.x - DEFAULT_BOX.x - GAP }
      }
      return { style: { images: [{ src, ...imgRect }], bodyBox: adjustedBox } }
    }

    // Primary parser — strict SLIDE_START/SLIDE_END blocks
    const blocks = [...text.matchAll(/SLIDE_START([\s\S]*?)SLIDE_END/g)]

    if (blocks.length > 0) {
      return blocks.map(m => {
        const block     = m[1]
        const titleM    = block.match(/TITLE:\s*(.+)/)
        const imageM    = block.match(/^IMAGE:\s*(.+)/m)
        const placementM= block.match(/^PLACEMENT:\s*(.+)/m)
        // Bullets stop at TABLE or IMAGE line
        const bulletSection = block.split(/^(?:TABLE|IMAGE)/m)[0]
        const bulletsM  = [...bulletSection.matchAll(/^[-•*]\s*(.+)/gm)]
        const table     = parseTable(block)
        const imgName   = imageM?.[1]?.trim()
        const placement = placementM?.[1]?.trim() ?? 'bottom'
        const imgStyle  = imgName ? applyImagePlacement(imgName, placement, imageMap) : {}
        return {
          title:   stripMd(titleM?.[1]?.trim() ?? 'Untitled slide'),
          body:    bulletsM.map(b => stripMd(b[1].trim())).join('\n'),
          bullets: bulletsM.map(b => stripMd(b[1].trim())),
          table,
          ...imgStyle,
        }
      })
    }

    // Fallback — if the AI forgot the markers, try to extract a title + bullets
    // Look for bold/heading-style title followed by bullet lines
    const fallbackTitle = text.match(/\*\*([^*]+)\*\*|^#{1,3}\s+(.+)/m)
    const fallbackBullets = [...text.matchAll(/^[-•*]\s*(.+)/gm)]
    
    if (fallbackBullets.length >= 2) {
      return [{
        title:   fallbackTitle?.[1]?.trim() ?? fallbackTitle?.[2]?.trim() ?? 'Suggested slide',
        body:    fallbackBullets.map(b => b[1].trim()).join('\n'),
        bullets: fallbackBullets.map(b => b[1].trim()),
      }]
    }

    return []
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ ...styles.headerDot, background: deptColor }} />
        <span style={styles.headerTitle}>AI Assistant — {deptName}</span>
        {clientName && <span style={styles.clientPill}>{clientName}</span>}
      </div>

      {/* Slide limit banner */}
      {!isAdmin && slideLimit && (
        <div style={{
          padding: '8px 14px',
          background: atLimit ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.04)',
          borderBottom: '0.5px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, color: atLimit ? '#dc2626' : 'var(--color-text-muted)', flex: 1 }}>
            {atLimit
              ? `Slide limit reached: ${totalSlides ?? 0} / ${effectiveLimit} slides used.`
              : `Slides used: ${totalSlides ?? 0} / ${effectiveLimit}`}
          </span>
          {atLimit && requestStatus !== 'sent' && requestStatus !== 'already_pending' && (
            <button
              style={{ fontSize: 11, padding: '4px 10px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
              onClick={() => setShowRequestForm(v => !v)}
            >
              {showRequestForm ? 'Cancel' : 'Request more slides'}
            </button>
          )}
          {requestStatus === 'sent'            && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Request sent — awaiting admin approval</span>}
          {requestStatus === 'already_pending' && <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>You already have a pending request</span>}
          {requestStatus === 'error'           && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Failed to send request — try again</span>}
          {showRequestForm && (
            <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 4 }}>
              <input
                style={{ flex: 1, fontSize: 12, padding: '5px 8px', border: '0.5px solid var(--color-border)', borderRadius: 4, background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
                placeholder="Optional note for the admin…"
                value={requestNote}
                onChange={e => setRequestNote(e.target.value)}
              />
              <button
                style={{ fontSize: 12, padding: '5px 12px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                disabled={requestStatus === 'pending'}
                onClick={handleRequestMore}
              >
                {requestStatus === 'pending' ? 'Sending…' : 'Send request'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={styles.messages}>
        {/* Welcome */}
        {messages.length === 0 && (() => {
          const fileData    = loadFiles(clientId, deptId)
          const globalData  = loadGlobalFiles(clientId)
          const allFileNames = [
            ...globalData.files.map(f => ({ name: f.name, global: true })),
            ...fileData.files.map(f => ({ name: f.name, global: false })),
          ]
          return (
          <div style={styles.welcome}>
            <p style={styles.welcomeTitle}>Ready to build slides for {clientName || 'this client'}</p>
            {allFileNames.length === 0 && (
              <p style={styles.welcomeSub}>
                No files uploaded yet. Add files in the <strong>Files</strong> tab or
                the <strong>Global Files</strong> section, then come back here.
              </p>
            )}
            <div style={styles.suggestions}>
              {getSuggestions(clientName).map((s, i) => (
                <button key={i} style={styles.suggestion} onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          )
        })()}

        {/* Chat history */}
        {messages.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? styles.userBubbleWrap : styles.aiBubbleWrap}>
            {msg.role === 'user' ? (
              <div style={styles.userBubble}>
                {msg.text}
                {msg.images?.length > 0 && (
                  <div style={styles.userBubbleImages}>
                    {msg.images.map(n => <span key={n} style={styles.userBubbleImg}>🖼 {n}</span>)}
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.aiBubble}>
                {msg.text && <p style={styles.aiText}>{msg.text}</p>}

                {/* Slide cards */}
                {(msg.slides || []).map((slide, si) => (
                  <div key={si} style={styles.slideCard}>
                    <div style={styles.slideCardHeader}>
                      <span style={styles.slideCardLabel}>Suggested slide</span>
                      <button
                        style={{ ...styles.addSlideBtn, ...(atLimit ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
                        disabled={atLimit}
                        title={atLimit ? `Slide limit reached (${effectiveLimit}). Request admin approval for more.` : ''}
                        onClick={() => {
                          if (atLimit) return
                          onAddSlide({ title: slide.title, body: slide.body, bullets: slide.bullets, table: slide.table ?? null, style: slide.style ?? {} })
                        }}
                      >
                        + Add to deck
                      </button>
                    </div>
                    <p style={styles.slideCardTitle}>{slide.title}</p>
                    {slide.bullets?.length > 0 && (
                      <ul style={styles.slideCardBullets}>
                        {slide.bullets.map((b, bi) => (
                          <li key={bi} style={styles.slideCardBullet}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {slide.table && (
                      <div style={styles.tableWrap}>
                        <table style={styles.table}>
                          <thead>
                            <tr>{slide.table.headers.map((h, i) => <th key={i} style={styles.th}>{h}</th>)}</tr>
                          </thead>
                          <tbody>
                            {slide.table.rows.map((row, ri) => (
                              <tr key={ri}>
                                {row.map((cell, ci) => <td key={ci} style={styles.td}>{cell}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div style={styles.aiBubbleWrap}>
            <div style={styles.aiBubble}>
              <div style={styles.typing}>
                <span style={styles.dot1} />
                <span style={styles.dot2} />
                <span style={styles.dot3} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* File selector panel */}
      {(() => {
        const allFiles = getAllFiles()
        if (!allFiles.length) return null
        const activeCount = allFiles.length - excludedFiles.size
        return (
          <div style={styles.fileSelector}>
            <button style={styles.fileSelectorToggle} onClick={() => setShowFiles(v => !v)}>
              <span style={styles.fileSelectorIcon}>{showFiles ? '▾' : '▸'}</span>
              <span>Context files</span>
              <span style={styles.fileSelectorCount}>{activeCount}/{allFiles.length} active</span>
            </button>
            {showFiles && (
              <div style={styles.fileSelectorList}>
                {allFiles.map(f => {
                  const checked = !excludedFiles.has(f.name)
                  return (
                    <label key={f.name} style={styles.fileRow}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFile(f.name)}
                        style={{ flexShrink: 0 }}
                      />
                      {f._global && <span style={styles.globalBadge}>Global</span>}
                      <span style={{ ...styles.fileRowName, opacity: checked ? 1 : 0.4 }}>{f.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Image selector */}
      {(() => {
        const availableImages = getAvailableImages()
        if (!availableImages.length) return null
        return (
          <div style={styles.imageSelector}>
            <span style={styles.imageSelectorLabel}>Attach image:</span>
            {availableImages.map(img => {
              const selected = selectedImages.find(i => i.name === img.name)
              return (
                <button
                  key={img.name}
                  style={{ ...styles.imageChip, ...(selected ? styles.imageChipSelected : {}) }}
                  onClick={() => toggleImage(img)}
                  title={img.name}
                >
                  <img src={img.dataUrl} style={styles.imageThumb} alt={img.name} />
                  <span style={styles.imageChipName}>{img.name}</span>
                  {selected && <span style={styles.imageChipCheck}>✓</span>}
                </button>
              )
            })}
          </div>
        )
      })()}

      {/* Input */}
      <div style={styles.inputArea}>
        <textarea
          ref={inputRef}
          style={styles.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask me to draft a slide, summarise a file, pull key metrics…"
          rows={2}
          disabled={loading}
        />
        <button
          style={{ ...styles.sendBtn, opacity: (!input.trim() || loading) ? 0.4 : 1 }}
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%            { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}

const styles = {
  panel:          { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header:         { display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)', flexShrink: 0 },
  headerDot:      { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  headerTitle:    { fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' },
  clientPill:     { fontSize: 11, fontWeight: 600, color: '#1D9E75', background: '#1D9E7518', border: '0.5px solid #1D9E7544', borderRadius: 99, padding: '2px 10px' },
  messages:       { flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12 },
  welcome:        { display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' },
  welcomeTitle:   { fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' },
  welcomeSub:     { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 },
  fileList:       { display: 'flex', flexDirection: 'column', gap: 4 },
  fileListLabel:  { fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 },
  fileChip:       { fontSize: 12, color: 'var(--color-text-secondary)', background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 5, padding: '3px 9px', display: 'inline-block' },
  fileChipGlobal: { color: '#7F77DD', background: '#7F77DD12', borderColor: '#7F77DD44' },
  suggestions:    { display: 'flex', flexDirection: 'column', gap: 6 },
  suggestion:     { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer', textAlign: 'left', lineHeight: 1.4 },
  userBubbleWrap: { display: 'flex', justifyContent: 'flex-end' },
  aiBubbleWrap:   { display: 'flex', justifyContent: 'flex-start' },
  userBubble:     { background: 'var(--color-accent)', color: '#FFFFFF', borderRadius: '14px 14px 2px 14px', padding: '8px 12px', fontSize: 13, maxWidth: '85%', lineHeight: 1.5 },
  aiBubble:       { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '95%' },
  aiText:         { fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6, background: 'var(--color-bg-secondary)', borderRadius: '14px 14px 14px 2px', padding: '8px 12px', margin: 0 },
  slideCard:      { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
  slideCardHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  slideCardLabel: { fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  addSlideBtn:    { background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
  slideCardTitle: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 },
  slideCardBullets:{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 },
  slideCardBullet:{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 },
  tableWrap:      { overflowX: 'auto', marginTop: 6 },
  table:          { borderCollapse: 'collapse', width: '100%', fontSize: 11 },
  th:             { background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)', padding: '4px 8px', fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'left', whiteSpace: 'nowrap' },
  td:             { border: '0.5px solid var(--color-border)', padding: '3px 8px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  typing:         { display: 'flex', gap: 4, padding: '10px 14px', background: 'var(--color-bg-secondary)', borderRadius: '14px 14px 14px 2px', width: 48 },
  dot1:           { width: 6, height: 6, borderRadius: '50%', background: 'var(--color-text-muted)', animation: 'bounce 1.2s ease infinite 0s' },
  dot2:           { width: 6, height: 6, borderRadius: '50%', background: 'var(--color-text-muted)', animation: 'bounce 1.2s ease infinite 0.2s' },
  dot3:           { width: 6, height: 6, borderRadius: '50%', background: 'var(--color-text-muted)', animation: 'bounce 1.2s ease infinite 0.4s' },
  fileSelector:       { borderTop: '0.5px solid var(--color-border)', background: 'var(--color-bg)', flexShrink: 0 },
  fileSelectorToggle: { display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' },
  fileSelectorIcon:   { fontSize: 10, flexShrink: 0 },
  fileSelectorCount:  { marginLeft: 'auto', fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 99, padding: '1px 7px' },
  fileSelectorList:   { display: 'flex', flexDirection: 'column', gap: 1, padding: '4px 12px 8px', maxHeight: 140, overflowY: 'auto' },
  fileRow:            { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '2px 0' },
  fileRowName:        { fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, transition: 'opacity 0.15s' },
  globalBadge:        { fontSize: 9, fontWeight: 700, color: '#7F77DD', background: '#7F77DD18', border: '0.5px solid #7F77DD44', borderRadius: 99, padding: '1px 5px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.05em' },
  imageSelector:      { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderTop: '0.5px solid var(--color-border)', background: 'var(--color-bg)', flexShrink: 0, flexWrap: 'wrap' },
  imageSelectorLabel: { fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 },
  imageChip:          { display: 'flex', alignItems: 'center', gap: 4, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-secondary)', maxWidth: 140 },
  imageChipSelected:  { background: '#1D9E7518', borderColor: '#1D9E75', color: '#1D9E75' },
  imageThumb:         { width: 20, height: 20, objectFit: 'cover', borderRadius: 3, flexShrink: 0 },
  imageChipName:      { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  imageChipCheck:     { flexShrink: 0, fontWeight: 700 },
  userBubbleImages:   { marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4 },
  userBubbleImg:      { fontSize: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 6px' },
  inputArea:      { display: 'flex', gap: 8, padding: '10px 12px', borderTop: '0.5px solid var(--color-border)', background: 'var(--color-bg)', flexShrink: 0, alignItems: 'flex-end' },
  textarea:       { flex: 1, background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 10px', fontSize: 13, color: 'var(--color-text-primary)', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 },
  sendBtn:        { background: 'var(--color-accent)', color: '#FFFFFF', border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0 },
}