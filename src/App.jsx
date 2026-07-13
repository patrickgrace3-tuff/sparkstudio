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
import { DEPARTMENTS } from './lib/constants.js'
import { loadFunnelConfig } from './lib/funnel.js'
import { loadTeamConfig }  from './lib/team.js'
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
  const [editingSlide,   setEditingSlide]   = useState(null) // { index, slide } or { deckSlide, slide, item }
  const [showGlobal,     setShowGlobal]     = useState(false)
  const [showFunnel,     setShowFunnel]     = useState(false)
  const [showTeam,       setShowTeam]       = useState(false)

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
