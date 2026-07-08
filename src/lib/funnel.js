export const FUNNEL_STAGES = [
  {
    id: 'awareness',
    label: 'AWARENESS',
    items: [
      'YouTube Channel', 'Corporate Brand Content', 'Employer Brand Hub', 'Blog',
      'Press Releases', 'Social Media Content', 'Radio Ads (Local/Sirius)', 'PrintPromo Swag',
      'Video Content', 'FB/Instagram Stories', 'Collateral Material', 'Boosted Content',
      'Vendor Sponsored Articles', 'SEM Aware Brand Display', 'SEM Interactive Brand Display',
      'SEM Aware Video Display', 'Social Community Engagement', 'Fleet Intel', 'Driver Journey',
      'Employer Brand Ads',
    ],
  },
  {
    id: 'consideration',
    label: 'CONSIDERATION',
    items: [
      'Social Remarketing', 'Reputation Management Monitoring', 'SEM Aware Remarketing',
      'Social Monitoring', 'Social Engagement Ads', 'Hiring Events', 'Lead Assist Chatbot',
      'Lead Assist: Lead Status Nurturing', 'Lead Assist: First-Touch Nurturing',
      'Reputation Management Services', 'Social Media Page Like Campaign',
    ],
  },
  {
    id: 'conversion',
    label: 'CONVERSION',
    items: [
      'Performance Marketing Campaigns', 'SEM Interactive', 'SEM Aware Search',
      'Social Advertising Lead Ads', 'Job Boards', 'Conversation Analytics',
      'Virtual Recruiter', 'Internal Database Blasts', 'External Database Blasts',
      'Exit Banner', 'Social Advertising Domain Ads',
    ],
  },
  {
    id: 'retention',
    label: 'RETENTION',
    items: ['PDA', 'Reputation Management Surveys', 'Social Media Groups'],
  },
]

// Default: everything checked
function defaultConfig() {
  const cfg = {}
  for (const stage of FUNNEL_STAGES) {
    cfg[stage.id] = {}
    for (const item of stage.items) {
      cfg[stage.id][item] = true
    }
  }
  return cfg
}

const KEY = 'sparkstudio_funnel_config'

export function loadFunnelConfig() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultConfig()
    return JSON.parse(raw)
  } catch {
    return defaultConfig()
  }
}

export function saveFunnelConfig(cfg) {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}
