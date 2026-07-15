import React, { useState, useEffect } from 'react'
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
import AdminPanel    from './components/AdminPanel.jsx'
import { DEPARTMENTS } from './lib/constants.js'
import { loadFunnelConfig } from './lib/funnel.js'
import { loadTeamConfig }  from './lib/team.js'
import { loadTemplates, buildSeedSlides } from './lib/templates.js'
import { loadClients, saveClients } from './lib/clients.js'
import { loadSlides, saveSlides } from './lib/storage.js'
import { loadFiles, buildAIContext, loadGlobalFiles, saveGlobalFiles } from './lib/files.js'
import { enhanceSlideBody, generateDeck } from './lib/api.js'
import { exportToPptx } from './lib/export.js'

export default function App() {
  const [clients,        setClients]        = useState(loadClients)
  const [activeClientId, setActiveClientId] = useState(() => loadClients()[0]?.id)
  const [allSlidesMap,   setAllSlidesMap]   = useState({})
  const [deckMap,        setDeckMap]        = useState({})
  const [activeDeptId,   setActiveDeptId]   = useState(DEPARTMENTS[0].id)
  const [activeTab,      setActiveTab]      = useState('input')   // input | preview
  const [deptTab,        setDeptTab]        = useState('slides')  // slides | files | ai
  const [isGenerating,   setIsGenerating]   = useState(false)
  const [isEnhancing,    setIsEnhancing]    = useState(false)
  const [isExporting,    setIsExporting]    = useState(false)
  const [editingSlide,   setEditingSlide]   = useState(null) // { index, slide }
  const [showGlobal,     setShowGlobal]     = useState(false)
  const [showFunnel,     setShowFunnel]     = useState(false)
  const [showTeam,       setShowTeam]       = useState(false)
  const [showAdmin,         setShowAdmin]         = useState(false)
  const [selectedTemplate,  setSelectedTemplate]  = useState(null)
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false)

  useEffect(() => {
    if (!activeClientId) return
    if (!allSlidesMap[activeClientId]) {
      setAllSlidesMap(prev => ({ ...prev, [activeClientId]: loadSlides(activeClientId) }))
    }
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

  function handleAddClient(client) {
    const updated = [...clients, client]
    setClients(updated)
    saveClients(updated)
    setActiveClientId(client.id)
    setActiveTab('input')
    setDeptTab('slides')
    setActiveDeptId(DEPARTMENTS[0].id)
  }

  function handleDeleteClient(clientId) {
    const updated = clients.filter(c => c.id !== clientId)
    setClients(updated)
    saveClients(updated)
    setActiveClientId(updated[0]?.id)
  }

  // ── Slide mutations ────────────────────────────────────────────────────────
  function setSlides(updated) {
    setAllSlidesMap(prev => ({ ...prev, [activeClientId]: updated }))
    saveSlides(activeClientId, updated)
  }

  function addSlide(slide) {
    const withId = { ...slide, _id: slide._id ?? `s${Date.now()}${Math.random().toString(36).slice(2)}` }
    setSlides({ ...allSlides, [activeDeptId]: [...deptSlides, withId] })
  }

  function deleteSlide(index) {
    setSlides({ ...allSlides, [activeDeptId]: deptSlides.filter((_, i) => i !== index) })
  }

  function saveEditedSlide(index, updated) {
    const updatedList = deptSlides.map((s, i) => i === index ? updated : s)
    setSlides({ ...allSlides, [activeDeptId]: updatedList })
  }

  // ── AI ─────────────────────────────────────────────────────────────────────
  async function handleAiAssist(title, body) {
    setIsEnhancing(true)
    try { return await enhanceSlideBody(activeDept.name, title, body) }
    catch (err) { alert('AI enhancement failed: ' + err.message); return null }
    finally { setIsEnhancing(false) }
  }

  async function handleGenerate() {
    const contributions = DEPARTMENTS.filter(d => (allSlides[d.id] || []).length > 0)
    if (!contributions.length) return

    setIsGenerating(true)
    setActiveTab('preview')

    try {
      const globalData = loadGlobalFiles(activeClientId)
      const withData = contributions.map(d => {
        const fileData = loadFiles(activeClientId, d.id)
        const ctx = buildAIContext(fileData, d.name, globalData)
        return { dept: d.name, slides: allSlides[d.id] || [], deptSummary: ctx.deptSummary, globalSummary: ctx.globalSummary, imageFiles: ctx.imageFiles, pdfFiles: ctx.pdfFiles }
      })
      const result = await generateDeck(withData, activeClient.name)

      const allSlidesFlat = Object.values(allSlides).flat()
      result.slides = result.slides.map(genSlide => {
        const original = allSlidesFlat.find(s => s._id === genSlide.sourceId)
          ?? allSlidesFlat.find(s => s.title?.toLowerCase().trim() === genSlide.title?.toLowerCase().trim())
        if (!original) return genSlide
        return {
          ...genSlide,
          ...(original.table  ? { table:  original.table }  : {}),
          // Merge styles: AI-assigned images/layout take priority, then original style fills gaps
          style: { ...(original.style ?? {}), ...(genSlide.style ?? {}) },
          ...(original.source ? { source: original.source } : {}),
          ...(original.notes  ? { notes:  original.notes }  : {}),
        }
      })

      setDeckMap(prev => ({ ...prev, [activeClientId]: result }))
    } catch (err) {
      alert('Generation failed: ' + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  function handleEditDeckSlide(slideItem) {
    setEditingSlide({ deckSlide: true, slide: slideItem.slide, item: slideItem })
  }

  function saveDeckSlide(updated) {
    if (!deck) return
    setDeckMap(prev => {
      const prevDeck = prev[activeClientId]
      if (!prevDeck) return prev
      return {
        ...prev,
        [activeClientId]: {
          ...prevDeck,
          slides: prevDeck.slides.map(s => s === editingSlide.slide ? updated : s),
        },
      }
    })
  }

  async function handleExport(orderedSlides) {
    if (!deck) return
    setIsExporting(true)
    try { await exportToPptx(orderedSlides, deck) }
    catch (err) { alert('Export failed: ' + err.message) }
    finally { setIsExporting(false) }
  }

  function handleSelectDept(id) {
    setActiveDeptId(id)
    setDeptTab('slides')
    setActiveTab('input')
  }

  return (
    <div style={styles.root}>
      <ClientBar
        clients={clients}
        activeClientId={activeClientId}
        onSelect={handleSelectClient}
        onAdd={handleAddClient}
        onDelete={handleDeleteClient}
      />

      <div style={styles.body}>
        <Sidebar
          allSlides={allSlides}
          activeDeptId={activeDeptId}
          onSelectDept={handleSelectDept}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          presTitle={activeClient?.name ?? 'Presentation'}
          onOpenGlobal={() => setShowGlobal(true)}
          globalFileCount={loadGlobalFiles(activeClientId ?? '').files.length}
          onOpenFunnel={() => setShowFunnel(true)}
          onOpenTeam={() => setShowTeam(true)}
          onOpenAdmin={() => setShowAdmin(true)}
        />

        <div style={styles.main}>
          {showTeam && (
            <TeamBuilder onClose={() => setShowTeam(false)} />
          )}
          {showFunnel && (
            <FunnelBuilder onClose={() => setShowFunnel(false)} />
          )}
          {showAdmin && (
            <AdminPanel onClose={() => setShowAdmin(false)} />
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
                clientId={activeClientId}
                clientName={activeClient?.name}
                deptId="__global__"
                deptName="Global Files"
                deptColor="#7F77DD"
                isGlobal
              />
            </div>
          )}

          <div style={styles.tabBar}>
            {['input', 'preview'].map(tab => (
              <button
                key={tab}
                style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'input' ? 'Submit slides' : 'Preview deck'}
              </button>
            ))}
            <div style={styles.templatePicker}>
              <span style={styles.templateLabel}>Template:</span>
              <select
                style={styles.templateSelect}
                value={selectedTemplate?.id ?? ''}
                disabled={isApplyingTemplate}
                onChange={async e => {
                  const templates = loadTemplates()
                  const tmpl = templates.find(t => t.id === e.target.value) ?? null
                  setSelectedTemplate(tmpl)
                  if (!tmpl || !activeClientId) return

                  const globalData = loadGlobalFiles(activeClientId)
                  const deptContributions = DEPARTMENTS
                    .filter(d => (tmpl.departments[d.name] || []).length > 0)
                    .map(d => {
                      const fileData = loadFiles(activeClientId, d.id)
                      const ctx = buildAIContext(fileData, d.name, globalData)
                      const seeds = buildSeedSlides(tmpl, d.name).map((s, idx) => ({
                        ...s,
                        _id: `s${Date.now()}${idx}${Math.random().toString(36).slice(2)}`,
                      }))
                      return { dept: d.name, slides: seeds, deptSummary: ctx.deptSummary, globalSummary: ctx.globalSummary, imageFiles: ctx.imageFiles, pdfFiles: ctx.pdfFiles }
                    })

                  if (!deptContributions.length) return

                  setIsApplyingTemplate(true)
                  try {
                    const result = await generateDeck(deptContributions, activeClient?.name ?? '')
                    setAllSlidesMap(prev => {
                      const current = prev[activeClientId] ?? {}
                      const updated = { ...current }
                      result.slides.forEach(gen => {
                        const dept = DEPARTMENTS.find(d => d.name === gen.dept)
                        if (!dept) return
                        const slide = {
                          _id: `s${Date.now()}${Math.random().toString(36).slice(2)}`,
                          title: gen.title,
                          body: (gen.bullets ?? []).join('\n'),
                          bullets: gen.bullets ?? [],
                          dept: gen.dept,
                          style: gen.style ?? {},
                          _fromTemplate: true,
                        }
                        updated[dept.id] = [...(updated[dept.id] ?? []), slide]
                      })
                      saveSlides(activeClientId, updated)
                      return { ...prev, [activeClientId]: updated }
                    })
                  } catch (err) {
                    alert('Template generation failed: ' + err.message)
                  } finally {
                    setIsApplyingTemplate(false)
                  }
                }}
              >
                <option value="">None</option>
                {loadTemplates().map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
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
                </div>
              </div>

              {deptTab === 'slides' && (
                <>
                  <div style={styles.slideList}>
                    {deptSlides.length === 0 ? (
                      <p style={styles.emptyMsg}>No slides yet — add your first one below</p>
                    ) : (
                      deptSlides.map((slide, i) => (
                        <SlideCard
                          key={i}
                          slide={slide}
                          index={i}
                          deptColor={activeDept?.color}
                          onDelete={deleteSlide}
                          onEdit={idx => setEditingSlide({ index: idx, slide: deptSlides[idx] })}
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
                  clientId={activeClientId}
                  deptId={activeDeptId}
                  deptName={activeDept?.name}
                  deptColor={activeDept?.color}
                />
              )}

              {deptTab === 'ai' && (
                <AIAssistant
                  clientId={activeClientId}
                  clientName={activeClient?.name}
                  deptId={activeDeptId}
                  deptName={activeDept?.name}
                  deptColor={activeDept?.color}
                  allSlides={allSlides}
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
              isGenerating={isGenerating}
              onExport={handleExport}
              isExporting={isExporting}
              onEditSlide={handleEditDeckSlide}
            />
          )}

          <div style={styles.statusBar}>
            <span>
              <span style={styles.onlineDot} />
              {activeClient?.name} · {totalSlides} slide{totalSlides !== 1 ? 's' : ''} saved
            </span>
            {deck && <span style={styles.deckReady}>Deck ready to export</span>}
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
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
  slideList:       { flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  emptyMsg:        { fontSize: 14, color: 'var(--color-text-muted)', margin: 'auto', alignSelf: 'center', paddingTop: 40 },
  addArea:         { padding: '0 20px 18px' },
  statusBar:       { padding: '7px 20px', background: 'var(--color-bg-secondary)', borderTop: '0.5px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 16 },
  onlineDot:       { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', marginRight: 6, verticalAlign: 'middle' },
  deckReady:       { marginLeft: 'auto', color: 'var(--color-success)', fontWeight: 500 },
  globalOverlay:   { position: 'absolute', inset: 0, zIndex: 10, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' },
  globalHeader:    { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)', flexShrink: 0 },
  globalTitle:     { fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-text-primary)' },
  globalSub:       { fontSize: 12, color: 'var(--color-text-muted)', flex: 1 },
  globalClose:     { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-pill)', padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)', flexShrink: 0 },
  templatePicker:       { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingRight: 4 },
  templateLabel:        { fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 },
  templateSelect:       { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--color-text-secondary)', cursor: 'pointer', outline: 'none' },
  templateOverlay:      { position: 'absolute', inset: 0, zIndex: 20, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },
  templateSpinner:      { width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', animation: 'spin 0.8s linear infinite' },
  templateSpinnerLabel: { fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 500 },
}
