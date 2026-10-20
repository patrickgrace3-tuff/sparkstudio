export const TEAM_KEY = 'sparkstudio_team_config'

// The 8 segments of the outer wheel + center
export const WHEEL_DEPTS = [
  { id: 'digital_strategy',   label: 'DIGITAL STRATEGY'    },
  { id: 'brand_design',       label: 'BRAND & DESIGN'       },
  { id: 'creative',           label: 'CREATIVE'             },
  { id: 'social_marketing',   label: 'SOCIAL MARKETING'     },
  { id: 'innovation_product', label: 'INNOVATION & PRODUCT' },
  { id: 'data',               label: 'DATA'                 },
  { id: 'technology',         label: 'TECHNOLOGY'           },
  { id: 'development',        label: 'DEVELOPMENT'          },
  { id: 'client_services',    label: 'CLIENT SERVICES'      },
]

// The slide's wheel: four quadrants (main department on the red ring) with
// sub-departments on the black ring. Angles in degrees, clockwise from
// 12 o'clock; wheel units are 600×600 with the centre at 300,300 (outer
// edge r=300, photo area r 110–240, Client Services ring r 93–110).
export const WHEEL_QUADS = [
  { id: 'technology',         label: 'TECHNOLOGY',           start: 260, end: 350, labelAngle: 307,
    subs: [{ id: 'data', label: 'DATA', angle: 283 }, { id: 'development', label: 'DEVELOPMENT', angle: 322 }] },
  { id: 'digital_strategy',   label: 'DIGITAL STRATEGY',     start: 350, end: 440, labelAngle: 38,  subs: [] },
  { id: 'brand_design',       label: 'BRAND & DESIGN',       start: 80,  end: 170, labelAngle: 131,
    subs: [{ id: 'social_marketing', label: 'SOCIAL MARKETING', angle: 113 }, { id: 'creative', label: 'CREATIVE', angle: 153 }] },
  { id: 'innovation_product', label: 'INNOVATION & PRODUCT', start: 170, end: 260, labelAngle: 222, subs: [] },
]
export const wheelQuadOf = deptId => WHEEL_QUADS.find(q => q.id === deptId || q.subs.some(s => s.id === deptId))

// Named groups that appear in the right-hand sidebar column
export const DEFAULT_GROUPS = [
  { id: 'recruiting',  label: 'RECRUITING & CONSULTING' },
  { id: 'ai_team',     label: 'AI IMPLEMENTATION TEAM'  },
]

function defaultConfig() {
  return { members: [], groups: DEFAULT_GROUPS }
}

import { api } from './apiClient.js'

export function loadTeamConfig() {
  try { return JSON.parse(localStorage.getItem(TEAM_KEY)) || defaultConfig() }
  catch { return defaultConfig() }
}

export async function loadTeamConfigRemote(clientId) {
  try {
    const res = await api.getClientData(clientId, 'team')
    const cfg = res.value ?? defaultConfig()
    localStorage.setItem(TEAM_KEY, JSON.stringify(cfg))
    return cfg
  } catch { return loadTeamConfig() }
}

export function saveTeamConfig(cfg, clientId) {
  localStorage.setItem(TEAM_KEY, JSON.stringify(cfg))
  if (clientId) api.setClientData(clientId, 'team', cfg).catch(console.error)
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}
