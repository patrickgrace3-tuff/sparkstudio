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
import AdminPanel       from './components/AdminPanel.jsx'
import AdminDashboard  from './components/AdminDashboard.jsx'
import LoginScreen   from './components/LoginScreen.jsx'
import { DEPARTMENTS } from './lib/constants.js'
import { loadFunnelConfig } from './lib/funnel.js'
import { loadTeamConfig }  from './lib/team.js'
import { buildSeedSlides } from './lib/templates.js'
import { loadFiles, loadFilesRemote, buildAIContext, loadGlobalFiles, loadGlobalFilesRemote } from './lib/files.js'
import { enhanceSlideBody, generateDeck } from './lib/api.js'
import { exportToPptx } from './lib/export.js'
import { api, setToken } from './lib/apiClient.js'

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
  const [editingSlide,   setEditingSlide]   = useState(null)
  const [showGlobal,     setShowGlobal]     = useState(false)
  const [showFunnel,     setShowFunnel]     = useState(false)
  const [showTeam,       setShowTeam]       = useState(false)
  const [showAdmin,         setShowAdmin]         = useState(false)
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
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

  // ── Load clients after login ───────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return
    api.getClients().then(rows => {
      setClients(rows)
      if (rows.length) setActiveClientId(rows[0].id)
    }).catch(console.error)
    api.getTemplates().then(setTemplates).catch(console.error)
  }, [currentUser])

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
    api.bulkSaveSlides(activeClientId, updated).catch(console.error)
    setHasChanges(true)
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
    try { return await enhanceSlideBody(activeDept.name, title, body, activeClientId) }
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
      const result = await generateDeck(withData, activeClient.name, activeClientId)

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

  async function handlePushChanges() {
    if (!activeClientId) return
    setIsPushing(true)
    try {
      await api.bulkSaveSlides(activeClientId, allSlides)
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
          {showAdminDashboard && (
            <AdminDashboard
              onClose={() => setShowAdminDashboard(false)}
              currentUser={currentUser}
              onClientsChange={updated => {
                const normalized = updated.map(c => ({ id: c.id, name: c.name }))
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
            <div style={styles.templatePicker}>
              <span style={styles.templateLabel}>Template:</span>
              <select
                style={styles.templateSelect}
                value={selectedTemplate?.id ?? ''}
                disabled={isApplyingTemplate}
                onChange={async e => {
                  const tmpl = templates.find(t => t.id === e.target.value) ?? null
                  setSelectedTemplate(tmpl)
                  if (!tmpl || !activeClientId) return

                  const globalData = loadGlobalFiles(activeClientId)
                  const deptContributions = DEPARTMENTS
                    .filter(d => (tmpl.departments[d.name] || []).length > 0)
                    .map(d => {
                      const fileData = loadFiles(activeClientId, d.id)
                      const ctx      = buildAIContext(fileData, d.name, globalData)
                      const seeds    = buildSeedSlides(tmpl, d.name).map((s, idx) => ({
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
                      api.bulkSaveSlides(activeClientId, updated).catch(console.error)
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
                {templates.map(t => (
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
            <button
              style={{
                ...styles.generateBtn,
                opacity: (isGenerating || totalSlides === 0) ? 0.45 : 1,
                cursor:  (isGenerating || totalSlides === 0) ? 'not-allowed' : 'pointer',
              }}
              onClick={handleGenerate}
              disabled={isGenerating || totalSlides === 0}
            >
              {isGenerating ? 'Generating…' : 'Generate Presentation →'}
            </button>
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
  templatePicker:       { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingRight: 4 },
  templateLabel:        { fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 },
  templateSelect:       { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--color-text-secondary)', cursor: 'pointer', outline: 'none' },
  templateOverlay:      { position: 'absolute', inset: 0, zIndex: 20, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },
  templateSpinner:      { width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', animation: 'spin 0.8s linear infinite' },
  templateSpinnerLabel: { fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 500 },
}
