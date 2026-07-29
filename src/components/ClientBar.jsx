import React, { useState } from 'react'

function BetaGuideModal({ onClose }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
        <div style={styles.modalBody}>

          <div style={styles.brandRule} />

          <div style={styles.docHeader}>
            <div>
              <div style={styles.eyebrow}>Conversionia Internal</div>
              <h1 style={styles.docTitle}>Spark Studio Builder</h1>
              <p style={styles.docSubtitle}>AI-powered presentation builder for client-facing decks — built for your team, powered by your data.</p>
            </div>
            <div style={styles.docMeta}>
              <span style={styles.badge}>Beta Access</span>
              <span style={styles.metaLine}>Summer 2026</span>
              <span style={styles.metaLine}>Test User Guide</span>
            </div>
          </div>

          <div style={styles.sectionLabel}>What is Spark Studio?</div>
          <p style={styles.introP}>Spark Studio is a centralized presentation builder where each department contributes their slides, uploads supporting data, and lets AI turn raw notes and files into polished, client-ready decks — all in one place.</p>
          <p style={{ ...styles.introP, marginTop: 10 }}>Instead of chasing down slides from six teams and stitching them together in PowerPoint, every department works in their own section. When everyone is ready, the system generates the full presentation in seconds, formatted in the Conversionia template and ready to export.</p>

          <div style={styles.divider} />

          <div style={styles.sectionLabel}>How It Works</div>
          <div style={styles.steps}>
            {[
              { n: 1, title: 'Log in and select a client', desc: 'Your account gives you access to all assigned clients. Pick the one you\'re building a deck for — each client keeps its own slides, files, and presentation history.' },
              { n: 2, title: 'Navigate to your department', desc: 'The left sidebar lists every department. Each team works in their own section — you only need to focus on yours.' },
              { n: 3, title: 'Add your slides', desc: 'Give each slide a title and write your key points, data, or talking points in the body. You can also use AI Enhance to instantly polish rough notes into clean bullets.' },
              { n: 4, title: 'Upload your files', desc: 'Go to the Files tab inside your department and upload any supporting data — Looker reports, PDFs, spreadsheets, or images. The AI reads these when generating your slides.' },
              { n: 5, title: 'Generate the deck', desc: 'Hit Generate Presentation. The AI assembles all departments\' content into a single, formatted deck using the Conversionia PowerPoint template.' },
              { n: 6, title: 'Review, edit, and export', desc: 'The preview shows every slide. Click Edit on any slide to adjust content. When it\'s ready, hit Export PowerPoint to download the finished file.' },
            ].map(({ n, title, desc }) => (
              <div key={n} style={styles.step}>
                <div style={styles.stepNum}>{n}</div>
                <div>
                  <div style={styles.stepTitle}>{title}</div>
                  <div style={styles.stepDesc}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.divider} />

          <div style={styles.sectionLabel}>What's Available</div>
          <div style={styles.featGrid}>
            {[
              ['AI Slide Generation', 'Turns your notes and uploaded files into polished bullets, tables, and structured content.'],
              ['Slide Editor', 'Edit any generated slide — rewrite bullets, build tables, add images, reposition content boxes.'],
              ['PowerPoint Export', 'One-click export in the Conversionia template, ready to share or present directly.'],
              ['Funnel Builder', 'Auto-generates a visual funnel slide from your campaign data, with current and target views.'],
              ['Team Slide', 'Build a "My Team" slide with photos, names, and roles — saved per client.'],
              ['AI Assistant', 'A chat assistant in each department that answers questions about your client\'s data and files.'],
              ['Presentation History', 'Every generated deck is saved as a version — pull up any past presentation for a client.'],
              ['Multi-department Sync', 'All teams contribute independently. One click brings everything together into a single deck.'],
            ].map(([name, desc]) => (
              <div key={name} style={styles.featCard}>
                <div style={styles.featName}>{name}</div>
                <div style={styles.featDesc}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={styles.divider} />

          <div style={styles.sectionLabel}>What to Expect as a Beta Tester</div>
          <div style={styles.expectations}>
            <p style={styles.expectP}>This is an early access release. The core workflow is functional and ready to use, but you may encounter rough edges as we tune the system.</p>
            <p style={{ ...styles.expectP, fontWeight: 600, marginTop: 10 }}>A few things to keep in mind:</p>
            <ul style={styles.expectList}>
              <li>AI generation quality improves when you upload detailed files — the more context, the better the output.</li>
              <li>Generated slides can always be edited before exporting. Think of the AI as a first draft, not a final answer.</li>
              <li>Slide generation typically takes 10–30 seconds depending on the number of departments and files.</li>
              <li>Your feedback directly shapes what gets built next. If something feels off, let us know — specifics help.</li>
            </ul>
          </div>

          <div style={styles.divider} />

          <div style={styles.contactRow}>
            <div>
              <p style={styles.contactP}><strong>Access &amp; questions</strong><br />Accounts are created manually. If you need access, run into an issue, or have feedback, reach out directly.</p>
              <p style={{ ...styles.contactP, marginTop: 6 }}><strong>Patrick Grace</strong> · <a href="mailto:PGrace@conversionia.com" style={styles.emailLink}>PGrace@conversionia.com</a></p>
            </div>
            <a href="mailto:PGrace@conversionia.com" style={styles.feedbackBtn}>Send Feedback</a>
          </div>

          <div style={styles.bottomRule} />
          <p style={styles.footerNote}>Spark Studio by Conversionia · Internal Beta · Not for external distribution</p>

        </div>
      </div>
    </div>
  )
}

export default function ClientBar({ clients, activeClientId, onSelect, currentUser, onLogout }) {
  const [showGuide, setShowGuide] = useState(false)

  return (
    <>
      <div style={styles.bar}>
        <span style={styles.label}>Client</span>

        <select
          style={styles.select}
          value={activeClientId}
          onChange={e => onSelect(e.target.value)}
        >
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        <button style={styles.guideBtn} onClick={() => setShowGuide(true)}>
          Beta User Guide
        </button>

        {currentUser && (
          <div style={styles.userArea}>
            <span style={styles.userName}>{currentUser.name || currentUser.email}</span>
            <button style={styles.btnGhost} onClick={onLogout}>Sign out</button>
          </div>
        )}
      </div>

      {showGuide && <BetaGuideModal onClose={() => setShowGuide(false)} />}
    </>
  )
}

const RED = '#CD2F37'
const RED_DIM = '#9E2129'

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 20px',
    height: 48,
    background: 'var(--color-bg)',
    borderBottom: '0.5px solid var(--color-border)',
    flexShrink: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-display)',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    flexShrink: 0,
  },
  select: {
    background: 'var(--color-bg-secondary)',
    border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 32px 6px 12px',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    outline: 'none',
    minWidth: 200,
    appearance: 'auto',
  },
  guideBtn: {
    background: 'none',
    border: `1px solid ${RED}`,
    borderRadius: 'var(--radius-pill)',
    padding: '5px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: RED,
    cursor: 'pointer',
    flexShrink: 0,
    letterSpacing: '0.02em',
  },
  btnGhost: {
    background: 'none',
    border: '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-pill)',
    padding: '5px 12px',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  userName: {
    fontSize: 12,
    color: 'var(--color-text-muted)',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // ── Modal ──
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: 'var(--color-bg)',
    borderRadius: 12,
    width: '100%',
    maxWidth: 720,
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
    boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
  },
  closeBtn: {
    position: 'sticky',
    top: 16,
    float: 'right',
    marginRight: 20,
    marginTop: 16,
    background: 'var(--color-bg-secondary)',
    border: '0.5px solid var(--color-border)',
    borderRadius: '50%',
    width: 30,
    height: 30,
    fontSize: 13,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalBody: {
    padding: '32px 36px 40px',
  },

  // ── One-sheeter content ──
  brandRule: {
    height: 3,
    background: RED,
    borderRadius: 1,
    marginBottom: 28,
  },
  docHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 32,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: RED,
    marginBottom: 5,
  },
  docTitle: {
    fontSize: 26,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  docSubtitle: {
    fontSize: 14,
    color: 'var(--color-text-muted)',
    marginTop: 6,
    lineHeight: 1.5,
    maxWidth: 400,
  },
  docMeta: {
    textAlign: 'right',
    flexShrink: 0,
  },
  badge: {
    display: 'inline-block',
    background: '#FBF1F2',
    border: `1px solid ${RED}`,
    color: RED,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    borderRadius: 4,
    padding: '3px 8px',
    marginBottom: 5,
  },
  metaLine: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    display: 'block',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
    marginBottom: 12,
  },
  introP: {
    fontSize: 15,
    lineHeight: 1.7,
    color: 'var(--color-text-primary)',
  },
  divider: {
    borderTop: '1px solid var(--color-border)',
    margin: '28px 0',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  step: {
    display: 'grid',
    gridTemplateColumns: '34px 1fr',
    gap: 12,
    alignItems: 'start',
    background: 'var(--color-bg-secondary)',
    borderRadius: 8,
    padding: '12px 14px',
  },
  stepNum: {
    width: 26,
    height: 26,
    background: RED,
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    color: 'var(--color-text-muted)',
    lineHeight: 1.55,
  },
  featGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  featCard: {
    background: 'var(--color-bg-secondary)',
    borderRadius: 8,
    padding: '12px 14px',
  },
  featName: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    marginBottom: 3,
  },
  featDesc: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    lineHeight: 1.5,
  },
  expectations: {
    background: 'var(--color-bg-secondary)',
    borderLeft: `3px solid ${RED}`,
    borderRadius: '0 8px 8px 0',
    padding: '16px 18px',
  },
  expectP: {
    fontSize: 13,
    color: 'var(--color-text-primary)',
    lineHeight: 1.65,
  },
  expectList: {
    marginTop: 8,
    marginLeft: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 12,
    color: 'var(--color-text-muted)',
    lineHeight: 1.5,
  },
  contactRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  contactP: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
    lineHeight: 1.6,
  },
  emailLink: {
    color: RED,
    textDecoration: 'none',
  },
  feedbackBtn: {
    display: 'inline-block',
    background: RED,
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textDecoration: 'none',
    borderRadius: 6,
    padding: '9px 18px',
    flexShrink: 0,
  },
  bottomRule: {
    height: 1,
    background: 'var(--color-border)',
    marginTop: 28,
  },
  footerNote: {
    fontSize: 10,
    color: 'var(--color-text-muted)',
    marginTop: 10,
    textAlign: 'center',
    letterSpacing: '0.01em',
  },
}
