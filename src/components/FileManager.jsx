import React, { useState, useRef } from 'react'
import { loadFiles, saveFiles, loadGlobalFiles, saveGlobalFiles, uid } from '../lib/files.js'
import WordEditor  from './WordEditor.jsx'
import ExcelEditor from './ExcelEditor.jsx'

export default function FileManager({ clientId, deptId, deptName, deptColor, isGlobal = false }) {
  const [data,       setData]       = useState(() =>
    isGlobal ? loadGlobalFiles(clientId) : loadFiles(clientId, deptId)
  )
  const [activeFolderId, setActiveFolderId] = useState(null) // null = root
  const [openFile,   setOpenFile]   = useState(null)  // file being edited
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [folderDraft,   setFolderDraft]   = useState('')
  const [dragging,   setDragging]   = useState(false)
  const fileInputRef = useRef(null)

  function persist(updated) {
    setData(updated)
    if (isGlobal) saveGlobalFiles(clientId, updated)
    else saveFiles(clientId, deptId, updated)
  }

  // ── Folders ────────────────────────────────────────────────────────────────
  function createFolder() {
    const name = folderDraft.trim()
    if (!name) return
    const folder = { id: uid(), name, parentId: activeFolderId }
    persist({ ...data, folders: [...data.folders, folder] })
    setFolderDraft('')
    setNewFolderMode(false)
  }

  function deleteFolder(folderId) {
    const childFolderIds = getAllChildFolderIds(folderId)
    const toDelete = new Set([folderId, ...childFolderIds])
    persist({
      folders: data.folders.filter(f => !toDelete.has(f.id)),
      files:   data.files.filter(f => !toDelete.has(f.folderId)),
    })
    if (activeFolderId && toDelete.has(activeFolderId)) setActiveFolderId(null)
  }

  function getAllChildFolderIds(parentId) {
    const direct = data.folders.filter(f => f.parentId === parentId).map(f => f.id)
    return direct.flatMap(id => [id, ...getAllChildFolderIds(id)])
  }

  // ── Files ──────────────────────────────────────────────────────────────────
  function createFile(type) {
    const names = { word: 'New Document.docx', excel: 'New Spreadsheet.xlsx' }
    const defaults = { word: '', excel: { headers: ['Column 1', 'Column 2', 'Column 3'], rows: Array(5).fill(['', '', '']) } }
    const file = {
      id: uid(), name: names[type], type,
      folderId: activeFolderId,
      content: defaults[type],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updated = { ...data, files: [...data.files, file] }
    persist(updated)
    setOpenFile(file)
  }

  function saveFileContent(fileId, content) {
    const updated = {
      ...data,
      files: data.files.map(f =>
        f.id === fileId ? { ...f, content, updatedAt: new Date().toISOString() } : f
      ),
    }
    persist(updated)
    setOpenFile(prev => ({ ...prev, content }))
  }

  function renameFile(fileId, name) {
    persist({ ...data, files: data.files.map(f => f.id === fileId ? { ...f, name } : f) })
  }

  function deleteFile(fileId) {
    persist({ ...data, files: data.files.filter(f => f.id !== fileId) })
    if (openFile?.id === fileId) setOpenFile(null)
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload(fileObj) {
    const reader = new FileReader()
    reader.onload = e => {
      const base64 = e.target.result
      const file = {
        id: uid(), name: fileObj.name, type: 'upload',
        folderId: activeFolderId,
        content: { base64, mimeType: fileObj.type, size: fileObj.size },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      persist({ ...data, files: [...data.files, file] })
    }
    reader.readAsDataURL(fileObj)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    Array.from(e.dataTransfer.files).forEach(handleUpload)
  }

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  function getFolderPath(folderId) {
    const path = []
    let current = folderId
    while (current) {
      const f = data.folders.find(f => f.id === current)
      if (!f) break
      path.unshift(f)
      current = f.parentId
    }
    return path
  }

  const folderPath   = activeFolderId ? getFolderPath(activeFolderId) : []
  const subFolders   = data.folders.filter(f => f.parentId === activeFolderId)
  const currentFiles = data.files.filter(f => f.folderId === activeFolderId)

  // ── If a file is open, show the editor ────────────────────────────────────
  if (openFile) {
    const saved = data.files.find(f => f.id === openFile.id) ?? openFile
    return (
      <div style={styles.editorWrap}>
        <div style={styles.editorHeader}>
          <button style={styles.backBtn} onClick={() => setOpenFile(null)}>← Back</button>
          <input
            style={styles.fileNameInput}
            value={saved.name}
            onChange={e => renameFile(saved.id, e.target.value)}
          />
          <span style={styles.fileTypeBadge}>{saved.type === 'word' ? 'Word' : 'Excel'}</span>
        </div>
        <div style={styles.editorBody}>
          {saved.type === 'word' ? (
            <WordEditor
              value={saved.content}
              onChange={content => saveFileContent(saved.id, content)}
            />
          ) : (
            <ExcelEditor
              value={saved.content}
              onChange={content => saveFileContent(saved.id, content)}
            />
          )}
        </div>
      </div>
    )
  }

  // ── File browser ───────────────────────────────────────────────────────────
  return (
    <div
      style={{ ...styles.browser, ...(dragging ? styles.browserDragging : {}) }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button style={styles.toolBtn} onClick={() => createFile('word')}>+ Word doc</button>
        <button style={styles.toolBtn} onClick={() => createFile('excel')}>+ Excel sheet</button>
        <button style={styles.toolBtn} onClick={() => fileInputRef.current?.click()}>↑ Upload file</button>
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
          onChange={e => Array.from(e.target.files).forEach(handleUpload)} />
        <div style={{ flex: 1 }} />
        {newFolderMode ? (
          <div style={styles.folderInputRow}>
            <input
              style={styles.folderInput}
              value={folderDraft}
              onChange={e => setFolderDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setNewFolderMode(false) }}
              placeholder="Folder name"
              autoFocus
            />
            <button style={styles.toolBtn} onClick={createFolder}>Create</button>
            <button style={styles.ghostBtn} onClick={() => setNewFolderMode(false)}>Cancel</button>
          </div>
        ) : (
          <button style={styles.ghostBtn} onClick={() => setNewFolderMode(true)}>+ New folder</button>
        )}
      </div>

      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <button style={styles.crumbBtn} onClick={() => setActiveFolderId(null)}>
          {deptName}
        </button>
        {folderPath.map(f => (
          <React.Fragment key={f.id}>
            <span style={styles.crumbSep}>/</span>
            <button style={styles.crumbBtn} onClick={() => setActiveFolderId(f.id)}>{f.name}</button>
          </React.Fragment>
        ))}
      </div>

      {/* Drop hint */}
      {dragging && (
        <div style={styles.dropOverlay}>Drop files to upload</div>
      )}

      {/* Contents */}
      <div style={styles.contents}>
        {subFolders.length === 0 && currentFiles.length === 0 && (
          <div style={styles.empty}>
            No files yet — create a document, spreadsheet, or upload a file above.
            <br />You can also drag & drop files here.
          </div>
        )}

        {/* Folders */}
        {subFolders.map(folder => (
          <div key={folder.id} style={styles.item}>
            <button style={styles.itemMain} onClick={() => setActiveFolderId(folder.id)}>
              <span style={styles.itemIcon}>📁</span>
              <span style={styles.itemName}>{folder.name}</span>
            </button>
            <button style={styles.itemDelete} onClick={() => deleteFolder(folder.id)}>✕</button>
          </div>
        ))}

        {/* Files */}
        {currentFiles.map(file => {
          const icon = file.type === 'word' ? '📝' : file.type === 'excel' ? '📊' : '📎'
          const canOpen = file.type === 'word' || file.type === 'excel'
          const date = new Date(file.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
          return (
            <div key={file.id} style={styles.item}>
              <button
                style={{ ...styles.itemMain, cursor: canOpen ? 'pointer' : 'default' }}
                onClick={() => canOpen && setOpenFile(file)}
              >
                <span style={styles.itemIcon}>{icon}</span>
                <span style={styles.itemName}>{file.name}</span>
                <span style={styles.itemMeta}>{date}</span>
              </button>
              <button style={styles.itemDelete} onClick={() => deleteFile(file.id)}>✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  browser:        { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' },
  browserDragging:{ outline: '2px dashed var(--color-border-medium)', outlineOffset: -4 },
  toolbar:        { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderBottom: '0.5px solid var(--color-border)', flexWrap: 'wrap' },
  toolBtn:        { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--color-text-primary)', cursor: 'pointer', whiteSpace: 'nowrap' },
  ghostBtn:       { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' },
  folderInputRow: { display: 'flex', alignItems: 'center', gap: 6 },
  folderInput:    { background: 'var(--color-bg-secondary)', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '4px 9px', fontSize: 12, color: 'var(--color-text-primary)', outline: 'none', width: 160 },
  breadcrumb:     { display: 'flex', alignItems: 'center', gap: 2, padding: '7px 16px', borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)' },
  crumbBtn:       { background: 'none', border: 'none', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '1px 4px', borderRadius: 4 },
  crumbSep:       { fontSize: 12, color: 'var(--color-text-muted)' },
  dropOverlay:    { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500, color: 'var(--color-text-secondary)', zIndex: 10, pointerEvents: 'none' },
  contents:       { flex: 1, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2 },
  empty:          { fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', paddingTop: 40, lineHeight: 1.8 },
  item:           { display: 'flex', alignItems: 'center', borderRadius: 6, border: '0.5px solid transparent', transition: 'border 0.1s' },
  itemMain:       { flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '7px 8px', borderRadius: 6, cursor: 'pointer', textAlign: 'left' },
  itemIcon:       { fontSize: 15, flexShrink: 0 },
  itemName:       { fontSize: 13, color: 'var(--color-text-primary)', flex: 1 },
  itemMeta:       { fontSize: 11, color: 'var(--color-text-muted)' },
  itemDelete:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--color-text-muted)', padding: '4px 8px', opacity: 0.6 },
  editorWrap:     { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  editorHeader:   { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)' },
  backBtn:        { background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  fileNameInput:  { flex: 1, background: 'none', border: 'none', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', outline: 'none' },
  fileTypeBadge:  { fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)', padding: '2px 8px', borderRadius: 99, flexShrink: 0 },
  editorBody:     { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 16 },
}