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

// Named groups that appear in the right-hand sidebar column
export const DEFAULT_GROUPS = [
  { id: 'recruiting',  label: 'RECRUITING & CONSULTING' },
  { id: 'ai_team',     label: 'AI IMPLEMENTATION TEAM'  },
]

function defaultConfig() {
  return { members: [], groups: DEFAULT_GROUPS }
}

export function loadTeamConfig() {
  try { return JSON.parse(localStorage.getItem(TEAM_KEY)) || defaultConfig() }
  catch { return defaultConfig() }
}

export function saveTeamConfig(cfg) {
  localStorage.setItem(TEAM_KEY, JSON.stringify(cfg))
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}
