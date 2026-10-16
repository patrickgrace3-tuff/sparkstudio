// Client divisions — some clients are split into divisions, and selected
// departments produce their slide set once per division. Each division gets a
// system folder in those departments' files (and in Global Files); files
// outside any division folder are shared by every division.

export function clientDivisions(client) {
  return Array.isArray(client?.divisions) ? client.divisions.filter(d => d?.id && d?.name) : []
}

// Departments whose slides repeat per division ([] when the client has no divisions)
export function divisionDeptIds(client) {
  if (!clientDivisions(client).length) return []
  return Array.isArray(client?.division_depts) ? client.division_depts : []
}

export function deptUsesDivisions(client, deptId) {
  return divisionDeptIds(client).includes(deptId)
}

export const divisionFolderId = divisionId => `division-${divisionId}`

const DIVISION_PREFIX = divisionFolderId('')
const folderDivisionTag = f => f.divisionId ?? (f.id?.startsWith(DIVISION_PREFIX) ? f.id.slice(DIVISION_PREFIX.length) : null)

// Removes folders of divisions not in keepIds. Their subfolders and files move
// up to the root (so they count for all divisions) — nothing is deleted.
// Mirrors stripInactiveDivisionFolders in server/routes/clients.js.
export function stripInactiveDivisionFolders(data, keepIds) {
  const folders = data.folders ?? []
  const files   = data.files ?? []
  const removed = new Set(folders.filter(f => { const d = folderDivisionTag(f); return d && !keepIds.has(d) }).map(f => f.id))
  const orphaned = id => id && (removed.has(id) || (id.startsWith(DIVISION_PREFIX) && !keepIds.has(id.slice(DIVISION_PREFIX.length))))
  if (!removed.size && !files.some(f => orphaned(f.folderId))) return data
  return {
    ...data,
    folders: folders.filter(f => !removed.has(f.id)).map(f => (orphaned(f.parentId) ? { ...f, parentId: null } : f)),
    files:   files.map(f => (orphaned(f.folderId) ? { ...f, folderId: null } : f)),
  }
}

// Keeps exactly one root folder per active division (names kept in sync) and
// drops folders of removed divisions. Returns the same object when nothing
// changed so callers can skip a save.
export function ensureDivisionFolders(data, divisions) {
  const synced  = stripInactiveDivisionFolders(data, new Set(divisions.map(d => d.id)))
  const folders = [...(synced.folders ?? [])]
  let changed = synced !== data
  for (const d of divisions) {
    const id  = divisionFolderId(d.id)
    const idx = folders.findIndex(f => f.id === id)
    if (idx === -1) {
      folders.push({ id, name: d.name, parentId: null, divisionId: d.id })
      changed = true
    } else if (folders[idx].name !== d.name || folders[idx].parentId !== null) {
      folders[idx] = { ...folders[idx], name: d.name, parentId: null, divisionId: d.id }
      changed = true
    }
  }
  return changed ? { ...synced, folders } : data
}

// The files blob as it should be for this client: active division folders
// only. Use before reading files for generation or the AI Assistant.
export function syncedDeptFiles(data, client, deptId) {
  return stripInactiveDivisionFolders(data, new Set(deptUsesDivisions(client, deptId) ? clientDivisions(client).map(d => d.id) : []))
}
export function syncedGlobalFiles(data, client) {
  return stripInactiveDivisionFolders(data, new Set(clientDivisions(client).map(d => d.id)))
}

// The division a folder sits under (walking up parents), or null if shared
function folderDivision(folders, folderId) {
  const byId = new Map(folders.map(f => [f.id, f]))
  const PREFIX = divisionFolderId('')
  let id = folderId
  const seen = new Set()
  while (id && !seen.has(id)) {
    const cur = byId.get(id)
    if (cur?.divisionId) return cur.divisionId
    // Division folders are virtual until first saved, so match by id as well
    if (id.startsWith(PREFIX)) return id.slice(PREFIX.length)
    seen.add(id)
    id = cur?.parentId ?? null
  }
  return null
}

// Splits a files blob into shared files and one bucket per division
export function splitFilesByDivision(data) {
  const folders = data?.folders ?? []
  const shared = []
  const byDivision = {}
  for (const f of data?.files ?? []) {
    const div = folderDivision(folders, f.folderId)
    if (div) (byDivision[div] ??= []).push(f)
    else shared.push(f)
  }
  return { shared, byDivision }
}

// Division id for a single file (null = shared by all divisions)
export function fileDivisionId(data, file) {
  return folderDivision(data?.folders ?? [], file?.folderId)
}

// Folder names from the root down to the file's folder, e.g. ['North', 'Q3']
export function fileFolderPath(data, file, divisions = []) {
  const byId = new Map((data?.folders ?? []).map(f => [f.id, f]))
  const names = []
  const seen = new Set()
  let id = file?.folderId
  while (id && !seen.has(id)) {
    seen.add(id)
    const f = byId.get(id)
    const divId = id.startsWith(divisionFolderId('')) ? id.slice(divisionFolderId('').length) : null
    names.unshift(f?.name ?? divisions.find(d => d.id === divId)?.name ?? '…')
    id = f?.parentId ?? null
  }
  return names
}
