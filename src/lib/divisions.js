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

// Adds a root folder per division (and keeps names in sync). Returns the same
// object when nothing changed so callers can skip a save.
export function ensureDivisionFolders(data, divisions) {
  const folders = [...(data.folders ?? [])]
  let changed = false
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
  return changed ? { ...data, folders } : data
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
