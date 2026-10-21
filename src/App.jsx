import React, { useState, useEffect, useRef } from 'react'
import ClientBar    from './components/ClientBar.jsx'
import Sidebar      from './components/Sidebar.jsx'
import SlideCard    from './components/SlideCard.jsx'
import AddSlideForm from './components/AddSlideForm.jsx'
import PreviewPanel from './components/PreviewPanel.jsx'
import FileManager  from './components/FileManager.jsx'
import SlideEditor  from './components/SlideEditor.jsx'
import AIAssistant  from './components/AIAssistant.jsx'
import FunnelBuilder from './components/FunnelBuilder.jsx'
import TeamBuilder   from './components/TeamBuilder.jsx'
import AdminPanel          from './components/AdminPanel.jsx'
import SlideToTemplateModal from './components/SlideToTemplateModal.jsx'
import AdminDashboard  from './components/AdminDashboard.jsx'
import LoginScreen   from './components/LoginScreen.jsx'
import MarketResearchPicker from './components/MarketResearchPicker.jsx'
import { DEPARTMENTS } from './lib/constants.js'
import { loadFunnelConfig } from './lib/funnel.js'
import { loadTeamConfig }  from './lib/team.js'
import { seedFromShell } from './lib/templates.js'
import { isOriginalShell, slideFromOriginalShell } from './lib/templateOriginals.js'
import { loadFiles, loadFilesRemote, buildAIContext, loadGlobalFiles, loadGlobalFilesRemote } from './lib/files.js'
import { enhanceSlideBody, generateDeck } from './lib/api.js'
import { exportToPptx } from './lib/export.js'
import { importSlidesFromPptx, importOriginalSlidesFromPptx } from './lib/importPptx.js'
import { isLockedOriginal, originalPptxKey } from './lib/originalSlides.js'
import { clientDivisions, deptUsesDivisions, splitFilesByDivision, syncedDeptFiles, syncedGlobalFiles } from './lib/divisions.js'
import { fetchMarketResearchForClient, fetchClientMarketResearchCopy, marketResearchDeckSlides, insertMarketResearch, withoutMarketResearch, MARKET_RESEARCH_DEPT_ID } from './lib/marketResearch.js'
import ClientMarketResearchEditor from './components/ClientMarketResearchEditor.jsx'
import OriginalSlideViewer from './components/OriginalSlideViewer.jsx'
import OriginalSlideEditor from './components/OriginalSlideEditor.jsx'
import { api, setToken } from './lib/apiClient.js'
import { saveSlides } from './lib/slideSave.js'

export default function App() {
  const [currentUser,    setCurrentUser]    = useState(null)
  const [authChecked,    setAuthChecked]    = useState(false)
  const [clients,        setClients]        = useState([])
  const [activeClientId, setActiveClientId] = useState(null)
  const [allSlidesMap,   setAllSlidesMap]   = useState({})
  const [deckMap,        setDeckMap]        = useState({})
  const [presentations,  setPresentations]  = useState([])  // version list for active client
  const [templates,      setTemplates]      = useState([])
  const [activeDeptId,   setActiveDeptId]   = useState(DEPARTMENTS[0].id)
  const [activeTab,      setActiveTab]      = useState('input')
  const [deptTab,        setDeptTab]        = useState('slides')
  const [isGenerating,   setIsGenerating]   = useState(false)
  const [isEnhancing,    setIsEnhancing]    = useState(false)
  const [isExporting,    setIsExporting]    = useState(false)
  const [isImporting,    setIsImporting]    = useState(false)
  const importInputRef = useRef(null)
  const [pendingImport,  setPendingImport]  = useState(null) // { file, keepStyling } while the import dialog is open
  const [viewingOriginal, setViewingOriginal] = useState(null) // { slides, index } for the full-size viewer
  const [editingOriginal, setEditingOriginal] = useState(null) // { slide, deckSlide? } for the original-styling editor
  const [showMarketResearch, setShowMarketResearch] = useState(false)
  const [presentationOrder,  setPresentationOrder]  = useState(null) // platform default, null = built-in order
  const [marketResearch,     setMarketResearch]     = useState(null) // latest deck summary, added to Marketing on generate
  const [mrClientCopy,       setMrClientCopy]       = useState(null) // this client's edited copy (deckId) or null
  const [showClientMR,       setShowClientMR]       = useState(false)
  const [editingSlide,   setEditingSlide]   = useState(null)
  const [showGlobal,     setShowGlobal]     = useState(false)
  const [showFunnel,     setShowFunnel]     = useState(false)
  const [showTeam,       setShowTeam]       = useState(false)
  const [showAdmin,         setShowAdmin]         = useState(false)
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [templateSlide,      setTemplateSlide]      = useState(null) // { slide, deptName }
  const [selectedTemplate,  setSelectedTemplate]  = useState(null)
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false)
  const [filesVersion,       setFilesVersion]       = useState(0)
  const [isPushing,          setIsPushing]          = useState(false)
  const [isPulling,          setIsPulling]          = useState(false)
  const [pushMsg,            setPushMsg]            = useState('')
  const [hasChanges,         setHasChanges]         = useState(false)
  const [elapsedTime,        setElapsedTime]        = useState('')
  const changesStartedAt = useRef(null)
  const timerRef         = useRef(null)

  // ── Unsaved-changes timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (hasChanges) {
      if (!changesStartedAt.current) changesStartedAt.current = Date.now()
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - changesStartedAt.current) / 1000)
        const m = Math.floor(secs / 60)
        const s = secs % 60
        setElapsedTime(m > 0 ? `${m}m ${s}s` : `${s}s`)
      }, 1000)
    } else {
      clearInterval(timerRef.current)
      changesStartedAt.current = null
      setElapsedTime('')
    }
    return () => clearInterval(timerRef.current)
  }, [hasChanges])

  // ── Auth bootstrap ─────────────────────────────────────────────────────────
  useEffect(() => {
    api.me()
      .then(res => setCurrentUser(res.user))
      .catch(() => {})
      .finally(() => setAuthChecked(true))
  }, [])

  // ── Remember the selected client across refreshes (per user, this browser) ──
  const activeClientKey = currentUser ? `ss:activeClient:${currentUser.id}` : null

  useEffect(() => {
    if (!activeClientKey || !activeClientId) return
    try { localStorage.setItem(activeClientKey, activeClientId) } catch { /* storage unavailable */ }
  }, [activeClientKey, activeClientId])

  // ── Load clients after login ───────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return
    api.getClients().then(rows => {
      setClients(rows)
      if (!rows.length) return
      let savedId = null
      try { savedId = localStorage.getItem(`ss:activeClient:${currentUser.id}`) } catch { /* storage unavailable */ }
      // Fall back to the first client if the saved one was deleted
      setActiveClientId(rows.some(r => r.id === savedId) ? savedId : rows[0].id)
    }).catch(console.error)
    api.getTemplates().then(setTemplates).catch(console.error)
    loadPresentationOrder()
    loadMarketResearchInfo()
  }, [currentUser])

  function loadMarketResearchInfo() {
    api.getMarketResearchDecks().then(decks => setMarketResearch(decks?.[0] ?? null)).catch(() => setMarketResearch(null))
  }

  function loadPresentationOrder() {
    api.getSetting('presentation_order').then(setPresentationOrder).catch(() => setPresentationOrder(null))
  }

  // ── This client's edited copy of the Market Research slides ───────────────
  useEffect(() => {
    setMrClientCopy(null)
    if (!activeClientId) return
    fetchClientMarketResearchCopy(activeClientId).then(setMrClientCopy).catch(() => {})
  }, [activeClientId])
  const mrCustomised = !!(mrClientCopy && marketResearch && mrClientCopy.deckId === marketResearch.id)

  // ── Load slides when client changes ───────────────────────────────────────
  useEffect(() => {
    if (!activeClientId) return

    if (!allSlidesMap[activeClientId]) {
      api.getSlides(activeClientId).then(map => {
        const normalised = {}
        for (const [deptId, slides] of Object.entries(map)) {
          normalised[deptId] = slides.map(s => ({ ...s, _id: s.id }))
        }
        setAllSlidesMap(prev => ({ ...prev, [activeClientId]: normalised }))
      }).catch(console.error)
    }

    // Load presentations list then hydrate deckMap with the latest saved deck
    api.getPresentations(activeClientId).then(async rows => {
      setPresentations(rows)
      if (rows.length && !deckMap[activeClientId]) {
        try {
          const latest = await api.getPresentation(activeClientId, rows[0].id)
          setDeckMap(prev => ({ ...prev, [activeClientId]: latest.deck }))
        } catch { /* non-fatal */ }
      }
    }).catch(console.error)

    // Load files for all departments and global from server
    Promise.all([
      loadGlobalFilesRemote(activeClientId),
      ...DEPARTMENTS.map(d => loadFilesRemote(activeClientId, d.id)),
    ]).then(() => setFilesVersion(v => v + 1)).catch(console.error)
  }, [activeClientId])

  const activeClient = clients.find(c => c.id === activeClientId)
  const allSlides    = allSlidesMap[activeClientId] ?? {}
  const activeDept   = DEPARTMENTS.find(d => d.id === activeDeptId)
  const deptSlides   = allSlides[activeDeptId] ?? []
  const deck         = deckMap[activeClientId] ?? null
  const totalSlides  = Object.values(allSlides).reduce((a, b) => a + b.length, 0)

  // ── Client management ──────────────────────────────────────────────────────
  function handleSelectClient(clientId) {
    setActiveClientId(clientId)
    setActiveTab('input')
    setDeptTab('slides')
    setActiveDeptId(DEPARTMENTS[0].id)
  }

  async function handleAddClient(client) {
    try {
      const created = await api.createClient(client.name)
      setClients(prev => [...prev, created])
      setActiveClientId(created.id)
      setActiveTab('input')
      setDeptTab('slides')
      setActiveDeptId(DEPARTMENTS[0].id)
    } catch (err) { alert('Failed to create client: ' + err.message) }
  }

  async function handleDeleteClient(clientId) {
    try {
      await api.deleteClient(clientId)
      const updated = clients.filter(c => c.id !== clientId)
      setClients(updated)
      setActiveClientId(updated[0]?.id ?? null)
    } catch (err) { alert('Failed to delete client: ' + err.message) }
  }

  // ── Slide mutations ────────────────────────────────────────────────────────
  function setSlides(updated) {
    setAllSlidesMap(prev => ({ ...prev, [activeClientId]: updated }))
    saveSlides(activeClientId, updated).catch(console.error)
    setHasChanges(true)
  }

  function addSlide(slide) {
    const withId = { ...slide, _id: slide._id ?? `s${Date.now()}${Math.random().toString(36).slice(2)}` }
    setSlides({ ...allSlides, [activeDeptId]: [...deptSlides, withId] })
  }

  function deleteSlide(index) {
    setSlides({ ...allSlides, [activeDeptId]: deptSlides.filter((_, i) => i !== index) })
  }

  // Moves a slide to the end of another department's list
  function moveSlide(index, toDeptId) {
    const sl = deptSlides[index]
    if (!sl || toDeptId === activeDeptId) return
    // A division only means something in departments that use divisions
    const { divisionId, ...rest } = sl
    const moved = divisionId && deptUsesDivisions(activeClient, toDeptId) ? sl : rest
    setSlides({
      ...allSlides,
      [activeDeptId]: deptSlides.filter((_, i) => i !== index),
      [toDeptId]: [...(allSlides[toDeptId] || []), moved],
    })
  }

  function saveEditedSlide(index, updated) {
    const updatedList = deptSlides.map((s, i) => i === index ? updated : s)
    setSlides({ ...allSlides, [activeDeptId]: updatedList })
  }

  // ── PPTX Import ───────────────────────────────────────────────────────────
  // Picking a file opens a small dialog. "Keep original styling" imports each
  // slide as an exact, locked copy of the original (exported unchanged);
  // otherwise only the content is taken and rebuilt on the template.
  function handleImportPptx(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setPendingImport({ file, keepStyling: false })
  }

  async function runImport({ file, keepStyling }) {
    setPendingImport(null)
    setIsImporting(true)
    try {
      const newId = () => `s${Date.now()}${Math.random().toString(36).slice(2)}`
      let withIds
      if (keepStyling) {
        const { pkg, slides } = await importOriginalSlidesFromPptx(file)
        if (!slides.length) { alert('No slides found in this file.'); return }
        const importId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
        const ref = originalPptxKey(importId)
        await api.setClientData(activeClientId, ref, { ...pkg, fileName: file.name, importedAt: new Date().toISOString() })
        withIds = slides.map(({ slidePath, preview }) => ({
          _id:     newId(),
          title:   preview.title || file.name.replace(/\.pptx$/i, ''),
          bullets: preview.text.filter(t => t.trim() && t.trim() !== preview.title),
          body:    preview.text.join('\n'),
          notes:   preview.notes ?? '',
          table:   null,
          style:   { original: { ref, importId, slidePath, fileName: file.name, slideW: pkg.slideW, slideH: pkg.slideH, preview } },
        }))
      } else {
        const imported = await importSlidesFromPptx(file)
        if (!imported.length) { alert('No slides found in this file.'); return }
        withIds = imported.map(s => ({ ...s, _id: newId(), style: s.style ?? {} }))
      }
      setSlides({ ...allSlides, [activeDeptId]: [...deptSlides, ...withIds] })
    } catch (err) {
      alert('Import failed: ' + err.message)
    } finally {
      setIsImporting(false)
    }
  }

  // ── Market Research import ────────────────────────────────────────────────
  // Stored content only (text, images, tables and their positions) — rendered
  // on the standard template, never the source deck's design.
  function handleImportMarketResearch(slides) {
    if (!slides.length) { alert('This market research deck has no slides.'); return }
    const withIds = slides.map(s => ({
      title:   s.title,
      bullets: s.bullets ?? [],
      body:    s.body ?? (s.bullets ?? []).join('\n'),
      table:   s.table ?? null,
      notes:   s.notes ?? '',
      source:  s.source ?? '',
      freeTextBoxes: s.freeTextBoxes ?? null,
      _id:     `s${Date.now()}${Math.random().toString(36).slice(2)}`,
      style:   s.style ?? {},
    }))
    setSlides({ ...allSlides, [activeDeptId]: [...deptSlides, ...withIds] })
    setDeptTab('slides')
  }

  // ── AI ─────────────────────────────────────────────────────────────────────
  async function handleAiAssist(title, body) {
    setIsEnhancing(true)
    try { return await enhanceSlideBody(activeDept.name, title, body, activeClientId) }
    catch (err) { alert('AI enhancement failed: ' + err.message); return null }
    finally { setIsEnhancing(false) }
  }

  // ── AI context for a department's slides ──────────────────────────────────
  // divisionId given → that division's files (shared dept files + its division
  // folders in the dept and Global Files). Otherwise → all of the dept's files
  // and every division's global files.
  function buildDeptContribution(d, slides, divisionId = null) {
    const globalData = syncedGlobalFiles(loadGlobalFiles(activeClientId), activeClient)
    const divisions  = clientDivisions(activeClient)
    const globalSplit  = splitFilesByDivision(globalData)
    const sharedGlobal = divisions.length ? { ...globalData, files: globalSplit.shared } : globalData
    const fileData = syncedDeptFiles(loadFiles(activeClientId, d.id), activeClient, d.id)
    const division = divisionId && deptUsesDivisions(activeClient, d.id) ? divisions.find(x => x.id === divisionId) : null
    if (!division) {
      const deptData = divisions.length ? { ...fileData, files: [...(fileData.files ?? []), ...Object.values(globalSplit.byDivision).flat()] } : fileData
      const ctx = buildAIContext(deptData, d.name, sharedGlobal)
      return { dept: d.name, slides, deptSummary: ctx.deptSummary, globalSummary: ctx.globalSummary, imageFiles: ctx.imageFiles, pdfFiles: ctx.pdfFiles }
    }
    const deptSplit = splitFilesByDivision(fileData)
    const files = [...deptSplit.shared, ...(deptSplit.byDivision[division.id] ?? []), ...(globalSplit.byDivision[division.id] ?? [])]
    const ctx = buildAIContext({ ...fileData, files }, `${d.name} — ${division.name}`, sharedGlobal)
    return { dept: d.name, division: division.name, slides, deptSummary: ctx.deptSummary, globalSummary: ctx.globalSummary, imageFiles: ctx.imageFiles, pdfFiles: ctx.pdfFiles }
  }

  // Applies a template: each department gets the template's slides (one set per
  // division where the department uses divisions), in the template's order.
  // Regular template slides are written by the AI on the standard layout;
  // imported slides keep their design and the AI rewrites their text.
  async function applyTemplate(tmpl) {
    const divisions = clientDivisions(activeClient)
    const newId = () => `s${Date.now()}${Math.random().toString(36).slice(2)}`
    const plan = []
    for (const d of DEPARTMENTS) {
      const shells = tmpl.departments[d.name] || []
      if (!shells.length) continue
      const divs = deptUsesDivisions(activeClient, d.id) && divisions.length ? divisions : [null]
      for (const div of divs) {
        plan.push({
          d, div,
          entries: shells.map(shell => (isOriginalShell(shell) ? { shell } : { seed: { ...seedFromShell(shell, d.name), _id: newId() } })),
        })
      }
    }
    if (!plan.length) return

    setIsApplyingTemplate(true)
    try {
      const contributions = plan
        .filter(p => p.entries.some(e => e.seed))
        .map(p => buildDeptContribution(p.d, p.entries.filter(e => e.seed).map(e => e.seed), p.div?.id ?? null))
      const originalJobs = plan.flatMap(p => p.entries.filter(e => e.shell).map(e => {
        const ctx = buildDeptContribution(p.d, [], p.div?.id ?? null)
        return slideFromOriginalShell(e.shell, { ...ctx, clientName: activeClient?.name ?? '', deptName: p.d.name, division: p.div?.name ?? null }, activeClientId)
          .then(slide => { e.slide = slide })
          .catch(err => { console.error(err); e.error = err.message })
      }))
      const [result] = await Promise.all([
        contributions.length ? generateDeck(contributions, activeClient?.name ?? '') : Promise.resolve({ slides: [] }),
        ...originalJobs,
      ])

      const generated = [...(result.slides ?? [])]
      const takeGenerated = (seed, deptName, divName) => {
        let i = generated.findIndex(g => g.sourceId === seed._id)
        if (i === -1) i = generated.findIndex(g => g.dept === deptName && (g.division ?? null) === divName)
        return i === -1 ? null : generated.splice(i, 1)[0]
      }
      const failed = []
      const additions = {} // dept id → new slides, in template order
      for (const p of plan) {
        const divName = p.div?.name ?? null
        const withDivision = title => (divName && !title?.includes(`— ${divName}`) ? `${title} — ${divName}` : title)
        for (const e of p.entries) {
          let slide = null
          if (e.seed) {
            const gen = takeGenerated(e.seed, p.d.name, divName)
            if (!gen) continue
            slide = {
              _id: newId(), title: withDivision(gen.title), divisionId: p.div?.id ?? null,
              body: (gen.bullets ?? []).join('\n'), bullets: gen.bullets ?? [], table: gen.table ?? null,
              dept: gen.dept, style: gen.style ?? {}, _fromTemplate: true,
            }
          } else if (e.slide) {
            slide = { ...e.slide, _id: newId(), title: withDivision(e.slide.title), divisionId: p.div?.id ?? null, dept: p.d.name }
          } else {
            failed.push(e.shell.title || 'Imported slide')
            continue
          }
          ;(additions[p.d.id] ??= []).push(slide)
        }
      }
      setAllSlidesMap(prev => {
        const current = prev[activeClientId] ?? {}
        const updated = { ...current }
        for (const [deptId, slides] of Object.entries(additions)) updated[deptId] = [...(updated[deptId] ?? []), ...slides]
        saveSlides(activeClientId, updated).catch(console.error)
        return { ...prev, [activeClientId]: updated }
      })
      if (failed.length) alert(`Some template slides could not be added:\n${failed.join('\n')}`)
    } catch (err) {
      alert('Template generation failed: ' + err.message)
    } finally {
      setIsApplyingTemplate(false)
    }
  }

  // Puts slides imported with their original styling back into the deck, in
  // their slide-builder position. Generated slides of a department keep their
  // order; each original sits after the generated slides of the builder slides
  // above it.
  function withLockedOriginals(all) {
    const generated = all.filter(g => !isLockedOriginal(g))
    if (!DEPARTMENTS.some(d => (allSlides[d.id] || []).some(isLockedOriginal))) return generated
    const out = []
    const used = new Set()
    for (const d of DEPARTMENTS) {
      const builder = allSlides[d.id] || []
      const gen = generated.filter(g => g.dept === d.name)
      const bySource = new Map()
      for (const g of gen) {
        if (!g.sourceId) continue
        if (!bySource.has(g.sourceId)) bySource.set(g.sourceId, [])
        bySource.get(g.sourceId).push(g)
      }
      for (const b of builder) {
        if (isLockedOriginal(b)) {
          const { _id, ...rest } = b
          out.push({ ...rest, dept: d.name, sourceId: _id })
          continue
        }
        for (const g of bySource.get(b._id) ?? []) { out.push(g); used.add(g) }
      }
      // Generated slides not tied to a builder slide stay with their department
      for (const g of gen) if (!used.has(g)) { out.push(g); used.add(g) }
    }
    for (const g of generated) if (!used.has(g)) out.push(g)
    return out
  }

  async function handleGenerate() {
    const hasSlides = DEPARTMENTS.filter(d => (allSlides[d.id] || []).length > 0)
    if (!hasSlides.length && !marketResearch) return
    // Slides imported with their original styling are used exactly as they are
    const contributions = hasSlides.filter(d => allSlides[d.id].some(sl => !isLockedOriginal(sl)))

    setIsGenerating(true)
    setActiveTab('preview')

    try {
      // Latest Market Research deck goes into every client's Marketing section as-is
      let mrSlides = []
      try { mrSlides = marketResearchDeckSlides(await fetchMarketResearchForClient(activeClientId)) }
      catch (err) { console.error('Could not load Market Research slides:', err) }

      // One presentation slide per slide-builder slide — no per-division
      // copies here. Slides tagged with a division (created from a template)
      // are generated with that division's files.
      const withData = contributions.flatMap(d => {
        const groups = new Map()
        for (const sl of allSlides[d.id] || []) {
          if (isLockedOriginal(sl)) continue
          const key = sl.divisionId ?? ''
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key).push(sl)
        }
        return [...groups].map(([divisionId, slides]) => buildDeptContribution(d, slides, divisionId || null))
      })
      // Market Research slides are re-added fresh below, so never carry old ones over
      const previousDeck = deck ? { ...deck, slides: withoutMarketResearch(deck.slides).filter(sl => !isLockedOriginal(sl)) } : null
      const result = withData.length
        ? await generateDeck(withData, activeClient.name, activeClientId, previousDeck)
        : { title: `${activeClient.name} Presentation`, slides: [], _deptFingerprints: {} }

      // Every presentation slide matches the slide built in the slide builder:
      // title, edited bullets, table, layout/style settings, extra bullet
      // areas, text boxes, source and notes all come from the builder slide —
      // for freshly generated slides and for ones reused from the last deck
      // (whose fingerprint ignores layout, so their saved settings would
      // otherwise go stale). Slides whose bullets were edited are not split
      // into "(cont'd)" slides, so they come out exactly as built.
      const allSlidesFlat = Object.values(allSlides).flat().filter(sl => !isLockedOriginal(sl))
      const isContd = sl => /\(cont'd\)\s*$/i.test(sl.title ?? '')
      result.slides = result.slides.flatMap(genSlide => {
        const { _fromExisting: _, ...slide } = genSlide
        const original = allSlidesFlat.find(s => s._id === slide.sourceId)
          ?? allSlidesFlat.find(s => s.title?.toLowerCase().trim() === slide.title?.toLowerCase().trim())
        if (!original) return [slide]
        const edited = 'bullets' in original
        if (isContd(slide)) return edited ? [] : [slide]
        // Builder settings win; an image the AI placed is kept only when the
        // slide has no images of its own (with the body box it made room with)
        const style = { ...(slide.style ?? {}), ...(original.style ?? {}) }
        const userImgs = original.style?.images
        if (!(Array.isArray(userImgs) && userImgs.length) && slide.style?.images?.length) {
          style.images = slide.style.images
          if (slide.style.bodyBox) style.bodyBox = slide.style.bodyBox
        }
        return [{
          ...slide,
          title: original.title || slide.title,
          ...(edited ? { bullets: original.bullets } : {}),
          // DB rows default to table: null, so only a real table counts
          ...(original.table != null ? { table: original.table } : {}),
          style,
          ...(original.source ? { source: original.source } : {}),
          ...(original.notes  ? { notes:  original.notes }  : {}),
          ...('extraBulletBoxes' in original ? { extraBulletBoxes: original.extraBulletBoxes } : {}),
          ...(original.freeTextBoxes?.length ? { freeTextBoxes: original.freeTextBoxes } : {}),
        }]
      })

      result.slides = withLockedOriginals(result.slides)
      result.slides = insertMarketResearch(result.slides, mrSlides)
      result.slides.forEach((sl, i) => { sl.num = i + 1 })

      setDeckMap(prev => ({ ...prev, [activeClientId]: result }))
      setHasChanges(true)

      // Save as a new presentation version in the database
      try {
        const saved = await api.savePresentation(activeClientId, { title: result.title, deck: result })
        setPresentations(prev => [saved, ...prev])
      } catch (err) {
        console.error('Failed to save presentation version:', err)
      }
    } catch (err) {
      alert('Generation failed: ' + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  function handleEditDeckSlide(slideItem) {
    if (isLockedOriginal(slideItem.slide)) { setEditingOriginal({ slide: slideItem.slide, deckSlide: true }); return }
    setEditingSlide({ deckSlide: true, slide: slideItem.slide, item: slideItem })
  }

  function saveDeckSlide(updated, original = editingSlide.slide) {
    if (!deck) return
    const newDeck = {
      ...deck,
      slides: deck.slides.map(s => s === original ? updated : s),
    }
    setDeckMap(prev => {
      const prevDeck = prev[activeClientId]
      if (!prevDeck) return prev
      return {
        ...prev,
        [activeClientId]: newDeck,
      }
    })
    // Persist the updated deck so slide edits (position, content) survive a page refresh.
    api.savePresentation(activeClientId, { title: newDeck.title, deck: newDeck }).catch(console.error)
  }

  async function handleExport(orderedSlides) {
    if (!deck) return
    setIsExporting(true)
    try { await exportToPptx(orderedSlides, deck, { clientId: activeClientId }) }
    catch (err) { alert('Export failed: ' + err.message) }
    finally { setIsExporting(false) }
  }

  async function handleDeletePresentation() {
    if (!activeClientId) return
    try {
      if (presentations.length) await api.deletePresentation(activeClientId, presentations[0].id)
    } catch { /* non-fatal — clear from UI regardless */ }
    setDeckMap(prev => { const n = { ...prev }; delete n[activeClientId]; return n })
    setPresentations([])
  }

  async function handlePushChanges() {
    if (!activeClientId) return
    setIsPushing(true)
    try {
      await saveSlides(activeClientId, allSlides)
      setHasChanges(false)
      setPushMsg('pushed')
      setTimeout(() => setPushMsg(''), 3000)
    } catch (err) {
      alert('Push failed: ' + err.message)
    } finally {
      setIsPushing(false)
    }
  }

  async function handlePullLatest() {
    if (!activeClientId) return
    setIsPulling(true)
    try {
      const [map] = await Promise.all([
        api.getSlides(activeClientId),
        loadGlobalFilesRemote(activeClientId),
        ...DEPARTMENTS.map(d => loadFilesRemote(activeClientId, d.id)),
      ])
      const normalised = {}
      for (const [deptId, slides] of Object.entries(map)) {
        normalised[deptId] = slides.map(s => ({ ...s, _id: s.id }))
      }
      setAllSlidesMap(prev => ({ ...prev, [activeClientId]: normalised }))
      setFilesVersion(v => v + 1)
      setPushMsg('pulled')
      setTimeout(() => setPushMsg(''), 3000)
    } catch (err) {
      alert('Pull failed: ' + err.message)
    } finally {
      setIsPulling(false)
    }
  }

  function handleSelectDept(id) {
    setActiveDeptId(id)
    setDeptTab('slides')
    setActiveTab('input')
  }

  if (!authChecked) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--color-text-muted)', fontSize:14 }}>Loading…</div>
  if (!currentUser)  return <LoginScreen onLogin={user => setCurrentUser(user)} />

  function handleLogout() {
    setToken(null)
    setCurrentUser(null)
    setClients([])
    setActiveClientId(null)
    setAllSlidesMap({})
    setDeckMap({})
    setPresentations([])
  }

  return (
    <div style={styles.root}>
      <ClientBar
        clients={clients}
        activeClientId={activeClientId}
        onSelect={handleSelectClient}
        currentUser={currentUser}
        onLogout={() => { setToken(null); setCurrentUser(null) }}
      />

      <div style={styles.body}>
        <Sidebar
          allSlides={allSlides}
          activeDeptId={activeDeptId}
          onSelectDept={handleSelectDept}
          presTitle={activeClient?.name ?? 'Presentation'}
          onOpenGlobal={() => setShowGlobal(true)}
          globalFileCount={loadGlobalFiles(activeClientId ?? '').files.length}
          onOpenFunnel={() => setShowFunnel(true)}
          onOpenTeam={() => setShowTeam(true)}
          onOpenAdmin={() => setShowAdmin(true)}
          onOpenAdminDashboard={() => setShowAdminDashboard(true)}
          currentUser={currentUser}
        />

        <div style={styles.main}>
          {showTeam && (
            <TeamBuilder onClose={() => setShowTeam(false)} clientId={activeClientId} />
          )}
          {showFunnel && (
            <FunnelBuilder onClose={() => setShowFunnel(false)} clientId={activeClientId} />
          )}
          {showAdmin && (
            <AdminPanel onClose={() => setShowAdmin(false)} onTemplatesChange={setTemplates} />
          )}
          {showMarketResearch && (
            <MarketResearchPicker
              deptName={activeDept?.name}
              onImport={handleImportMarketResearch}
              onClose={() => setShowMarketResearch(false)}
            />
          )}
          {showAdminDashboard && (
            <AdminDashboard
              onClose={() => { setShowAdminDashboard(false); loadPresentationOrder(); loadMarketResearchInfo() }}
              currentUser={currentUser}
              onClientsChange={updated => {
                const normalized = updated.map(c => ({ id: c.id, name: c.name, divisions: c.divisions ?? [], division_depts: c.division_depts ?? [] }))
                setClients(normalized)
                if (!normalized.find(c => c.id === activeClientId)) {
                  setActiveClientId(normalized[0]?.id ?? null)
                }
              }}
            />
          )}

          {isApplyingTemplate && (
            <div style={styles.templateOverlay}>
              <div style={styles.templateSpinner} />
              <div style={styles.templateSpinnerLabel}>Building slides from template…</div>
            </div>
          )}

          {showGlobal && activeClientId && (
            <div style={styles.globalOverlay}>
              <div style={styles.globalHeader}>
                <span style={styles.globalTitle}>🌐 Global Files</span>
                <span style={styles.globalSub}>Available to all departments and the AI assistant</span>
                <button style={styles.globalClose} onClick={() => setShowGlobal(false)}>✕ Close</button>
              </div>
              <FileManager
                key={`global:${activeClientId}:${filesVersion}`}
                clientId={activeClientId}
                clientName={activeClient?.name}
                deptId="__global__"
                deptName="Global Files"
                deptColor="#7F77DD"
                isGlobal
                divisions={clientDivisions(activeClient)}
              />
            </div>
          )}

          <div style={styles.tabBar}>
            <button
              style={{ ...styles.tab, ...(activeTab === 'input' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('input')}
            >
              Submit slides
            </button>
            {deck && (
              <button
                style={{ ...styles.tab, ...(activeTab === 'preview' ? styles.tabActive : {}) }}
                onClick={() => setActiveTab('preview')}
              >
                Preview deck
              </button>
            )}
            {currentUser?.role === 'admin' && <div style={styles.templatePicker}>
              <span style={styles.templateLabel}>Template:</span>
              <select
                style={styles.templateSelect}
                value={selectedTemplate?.id ?? ''}
                disabled={isApplyingTemplate}
                onChange={async e => {
                  const tmpl = templates.find(t => t.id === e.target.value) ?? null
                  setSelectedTemplate(tmpl)
                  if (!tmpl || !activeClientId) return

                  await applyTemplate(tmpl)
                }}
              >
                <option value="">None</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>}
          </div>

          {activeTab === 'input' && (
            <div style={styles.inputPane}>
              <div style={styles.deptHeader}>
                <span style={{ ...styles.deptDot, background: activeDept?.color }} />
                <span style={styles.deptLabel}>{activeDept?.name}</span>
                <div style={styles.subTabs}>
                  {[
                    { id: 'slides', label: `Slides (${deptSlides.length})` },
                    { id: 'files',  label: 'Files' },
                    { id: 'ai',     label: '✦ AI Assistant' },
                  ].map(t => (
                    <button
                      key={t.id}
                      style={{ ...styles.subTab, ...(deptTab === t.id ? styles.subTabActive : {}), ...(t.id === 'ai' ? styles.subTabAI : {}) }}
                      onClick={() => setDeptTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                  <button
                    style={styles.importBtn}
                    onClick={() => importInputRef.current?.click()}
                    disabled={isImporting}
                  >
                    {isImporting ? 'Importing…' : '↑ Import PPTX'}
                  </button>
                  <button
                    style={styles.importBtn}
                    onClick={() => setShowMarketResearch(true)}
                  >
                    ↓ Market Research
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".pptx"
                    style={{ display: 'none' }}
                    onChange={handleImportPptx}
                  />
                </div>
              </div>

              {deptTab === 'slides' && (
                <>
                  {activeDeptId === MARKET_RESEARCH_DEPT_ID && marketResearch && (
                    <button type="button" style={styles.mrNotice} onClick={() => setShowClientMR(true)} title="View or edit these slides for this client">
                      <strong>Market Research included automatically.</strong>{' '}
                      The latest deck, “{marketResearch.name}” ({marketResearch.slide_count} slide{marketResearch.slide_count === 1 ? '' : 's'}), is added at the start of {activeDept?.name} every time a presentation is generated. Admins manage it in Admin → Market Research.
                      <span style={styles.mrNoticeAction}>
                        {mrCustomised ? `Edited for ${activeClient?.name ?? 'this client'} · ` : ''}Click to view or edit for this client →
                      </span>
                    </button>
                  )}
                  {showClientMR && (
                    <ClientMarketResearchEditor
                      clientId={activeClientId}
                      clientName={activeClient?.name}
                      onClose={() => setShowClientMR(false)}
                      onChange={() => fetchClientMarketResearchCopy(activeClientId).then(setMrClientCopy).catch(() => {})}
                    />
                  )}
                  <div style={styles.slideList}>
                    {deptSlides.length === 0 ? (
                      <p style={styles.emptyMsg}>No slides yet — add your first one below</p>
                    ) : (
                      deptSlides.map((slide, i) => (
                        <SlideCard
                          key={slide._id ?? i}
                          slide={slide}
                          index={i}
                          deptColor={activeDept?.color}
                          onDelete={deleteSlide}
                          onEdit={idx => {
                            const sl = deptSlides[idx]
                            if (isLockedOriginal(sl)) setEditingOriginal({ slide: sl })
                            else setEditingSlide({ index: idx, slide: sl })
                          }}
                          onView={idx => setViewingOriginal({ slides: deptSlides, index: idx })}
                          onMove={moveSlide}
                          moveTargets={DEPARTMENTS.filter(d => d.id !== activeDeptId)}
                          onUseAsTemplate={currentUser?.role === 'admin' ? slide => setTemplateSlide({ slide, deptName: activeDept?.name }) : undefined}
                          divisionName={slide.divisionId && deptUsesDivisions(activeClient, activeDeptId) ? clientDivisions(activeClient).find(dv => dv.id === slide.divisionId)?.name : undefined}
                        />
                      ))
                    )}
                  </div>
                  <div style={styles.addArea}>
                    <AddSlideForm
                      onAdd={addSlide}
                      onAiAssist={handleAiAssist}
                      isEnhancing={isEnhancing}
                    />
                  </div>
                </>
              )}

              {deptTab === 'files' && (
                <FileManager
                  key={`${activeClientId}:${activeDeptId}:${filesVersion}`}
                  clientId={activeClientId}
                  deptId={activeDeptId}
                  deptName={activeDept?.name}
                  deptColor={activeDept?.color}
                  divisions={deptUsesDivisions(activeClient, activeDeptId) ? clientDivisions(activeClient) : []}
                />
              )}

              {deptTab === 'ai' && (
                <AIAssistant
                  divisions={clientDivisions(activeClient)}
                  deptDivisions={deptUsesDivisions(activeClient, activeDeptId) ? clientDivisions(activeClient) : []}
                  clientId={activeClientId}
                  clientName={activeClient?.name}
                  deptId={activeDeptId}
                  deptName={activeDept?.name}
                  deptColor={activeDept?.color}
                  allSlides={allSlides}
                  currentUser={currentUser}
                  totalSlides={totalSlides}
                  onAddSlide={slide => {
                    addSlide(slide)
                    setDeptTab('slides')
                  }}
                />
              )}
            </div>
          )}

          {activeTab === 'preview' && (
            <PreviewPanel
              deck={deck}
              funnelConfig={loadFunnelConfig()}
              teamConfig={loadTeamConfig()}
              presentationOrder={presentationOrder}
              isGenerating={isGenerating}
              onExport={handleExport}
              isExporting={isExporting}
              onEditSlide={handleEditDeckSlide}
              onDeletePresentation={handleDeletePresentation}
              onSlidesListChange={list => {
                if (!deck) return
                const newDeck = { ...deck, deckSlides: list }
                setDeckMap(prev => ({ ...prev, [activeClientId]: newDeck }))
                api.savePresentation(activeClientId, { title: newDeck.title, deck: newDeck }).catch(console.error)
              }}
            />
          )}

          <div style={styles.actionBar}>
            <span style={styles.actionStatus}>
              <span style={styles.onlineDot} />
              {activeClient?.name} · {totalSlides} slide{totalSlides !== 1 ? 's' : ''} saved
            </span>
            {pushMsg === 'pushed' && <span style={styles.syncMsg}>✓ Pushed</span>}
            {pushMsg === 'pulled' && <span style={styles.syncMsg}>✓ Pulled</span>}
            <div style={{ flex: 1 }} />
            <button style={styles.pullBtn} onClick={handlePullLatest} disabled={isPulling}>
              {isPulling ? 'Pulling…' : '↓ Pull Latest'}
            </button>
            <button
              style={hasChanges ? styles.pushBtnActive : styles.pushBtn}
              onClick={handlePushChanges}
              disabled={isPushing}
            >
              {isPushing
                ? '↑ Pushing…'
                : hasChanges
                  ? `↑ Push Changes${elapsedTime ? `  ·  ${elapsedTime}` : ''}`
                  : '↑ Push Changes'}
            </button>
            {currentUser?.role === 'admin' && (
              <button
                style={{
                  ...styles.generateBtn,
                  opacity: (isGenerating || (totalSlides === 0 && !marketResearch)) ? 0.45 : 1,
                  cursor:  (isGenerating || (totalSlides === 0 && !marketResearch)) ? 'not-allowed' : 'pointer',
                }}
                onClick={handleGenerate}
                disabled={isGenerating || (totalSlides === 0 && !marketResearch)}
              >
                {isGenerating ? 'Generating…' : 'Generate Presentation →'}
              </button>
            )}
          </div>
        </div>
      </div>

      {editingSlide && (
        <SlideEditor
          slide={editingSlide.slide}
          onSave={updated => {
            if (editingSlide.deckSlide) saveDeckSlide(updated)
            else saveEditedSlide(editingSlide.index, updated)
          }}
          onClose={() => setEditingSlide(null)}
        />
      )}

      {viewingOriginal && (
        <OriginalSlideViewer
          slides={viewingOriginal.slides}
          startIndex={viewingOriginal.index}
          onClose={() => setViewingOriginal(null)}
          subtitle={activeDept?.name ?? ''}
          onEdit={sl => {
            setViewingOriginal(null)
            if (isLockedOriginal(sl)) setEditingOriginal({ slide: sl })
            else { const idx = deptSlides.indexOf(sl); if (idx >= 0) setEditingSlide({ index: idx, slide: sl }) }
          }}
        />
      )}

      {editingOriginal && (
        <OriginalSlideEditor
          slide={editingOriginal.slide}
          clientId={activeClientId}
          onClose={() => setEditingOriginal(null)}
          onSave={updated => {
            if (editingOriginal.deckSlide) saveDeckSlide(updated, editingOriginal.slide)
            else {
              const idx = deptSlides.findIndex(sl => sl._id === editingOriginal.slide._id)
              if (idx !== -1) saveEditedSlide(idx, updated)
            }
            setEditingOriginal(null)
          }}
        />
      )}

      {pendingImport && (
        <div style={styles.importOverlay} onClick={() => setPendingImport(null)}>
          <div style={styles.importModal} role="dialog" aria-label="Import PowerPoint" onClick={e => e.stopPropagation()}>
            <div style={styles.importTitle}>Import PowerPoint</div>
            <div style={styles.importFile} title={pendingImport.file.name}>📄 {pendingImport.file.name}</div>
            <label style={styles.importOption}>
              <input
                type="checkbox"
                checked={pendingImport.keepStyling}
                onChange={e => setPendingImport(p => ({ ...p, keepStyling: e.target.checked }))}
              />
              <span>
                <strong>Keep original styling</strong>
                <span style={styles.importHint}>
                  {pendingImport.keepStyling
                    ? 'Text, fonts, sizes, colours, images, tables and charts stay exactly as they are in this file, placed on the Spark Studio template background. You can still edit each element — move, resize, crop, round corners, change text or delete — without losing the original look.'
                    : 'Unticked: the content (text, images, tables, charts) is taken from the file and rebuilt on the Spark Studio template, where you can edit it.'}
                </span>
              </span>
            </label>
            <div style={styles.importActions}>
              <button style={styles.pullBtn} onClick={() => setPendingImport(null)}>Cancel</button>
              <button style={styles.importGo} onClick={() => runImport(pendingImport)}>Import</button>
            </div>
          </div>
        </div>
      )}

      {templateSlide && (
        <SlideToTemplateModal
          slide={templateSlide.slide}
          deptName={templateSlide.deptName}
          siblings={deptSlides}
          templates={templates}
          clientId={activeClientId}
          onClose={() => setTemplateSlide(null)}
          onSaved={updated => setTemplates(updated)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.75} }
        [contenteditable] h1 { font-size: 1.5em; font-weight: 700; margin: 0.5em 0; }
        [contenteditable] h2 { font-size: 1.25em; font-weight: 600; margin: 0.4em 0; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 1.4em; margin: 0.3em 0; }
        [contenteditable] li { margin: 0.15em 0; }
      `}</style>
    </div>
  )
}

const styles = {
  root:            { height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg)' },
  body:            { flex: 1, display: 'flex', overflow: 'hidden' },
  main:            { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' },
  tabBar:          { display: 'flex', borderBottom: '0.5px solid var(--color-border)', padding: '0 16px', background: 'var(--color-bg)' },
  tab:             { padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent', marginBottom: -1, cursor: 'pointer' },
  tabActive:       { color: 'var(--color-accent)', borderBottomColor: 'var(--color-accent)', fontWeight: 600 },
  inputPane:       { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  deptHeader:      { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '0.5px solid var(--color-border)' },
  deptDot:         { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  deptLabel:       { fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', flex: 1 },
  subTabs:         { display: 'flex', gap: 2 },
  subTab:          { background: 'none', border: '0.5px solid transparent', borderRadius: 'var(--radius-pill)', padding: '4px 12px', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer' },
  subTabActive:    { background: 'var(--color-accent-tint)', border: '0.5px solid var(--color-border)', color: 'var(--color-accent-dark)', fontWeight: 500 },
  subTabAI:        { color: '#1D9E75' },
  mrNotice:        { display: 'block', width: 'calc(100% - 40px)', textAlign: 'left', font: 'inherit', cursor: 'pointer', margin: '12px 20px 0', fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-secondary)', background: '#1D9E7510', border: '0.5px solid #1D9E7540', borderRadius: 8, padding: '10px 14px' },
  mrNoticeAction:  { display: 'block', marginTop: 4, fontWeight: 600, color: '#1D9E75' },
  importBtn:       { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer', marginLeft: 4 },
  slideList:       { flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  emptyMsg:        { fontSize: 14, color: 'var(--color-text-muted)', margin: 'auto', alignSelf: 'center', paddingTop: 40 },
  addArea:         { padding: '0 20px 18px' },
  actionBar:       { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'var(--color-bg-secondary)', borderTop: '0.5px solid var(--color-border)', flexShrink: 0 },
  actionStatus:    { fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 0 },
  onlineDot:       { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', marginRight: 6 },
  syncMsg:         { fontSize: 11, color: 'var(--color-success)', fontWeight: 500 },
  pullBtn:         { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer', flexShrink: 0 },
  pushBtn:         { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '6px 14px', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer', flexShrink: 0 },
  pushBtnActive:   { background: '#F59E0B', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 16px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0, letterSpacing: '0.01em', animation: 'pulse 2s ease-in-out infinite' },
  generateBtn:     { background: 'var(--color-accent)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 20px', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 },
  globalOverlay:   { position: 'absolute', inset: 0, zIndex: 10, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' },
  globalHeader:    { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)', flexShrink: 0 },
  globalTitle:     { fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-text-primary)' },
  globalSub:       { fontSize: 12, color: 'var(--color-text-muted)', flex: 1 },
  globalClose:     { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)', flexShrink: 0 },
  importOverlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  importModal:     { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: 460, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  importTitle:     { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' },
  importFile:      { fontSize: 12, color: 'var(--color-text-secondary)', background: 'var(--color-bg-secondary)', borderRadius: 6, padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  importOption:    { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer' },
  importHint:      { display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5 },
  importActions:   { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  importGo:        { background: 'var(--color-accent)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 18px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  templatePicker:       { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingRight: 4 },
  templateLabel:        { fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 },
  templateSelect:       { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--color-text-secondary)', cursor: 'pointer', outline: 'none' },
  templateOverlay:      { position: 'absolute', inset: 0, zIndex: 20, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },
  templateSpinner:      { width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', animation: 'spin 0.8s linear infinite' },
  templateSpinnerLabel: { fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 500 },
}
