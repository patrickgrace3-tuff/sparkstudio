# Spark Studio — MVP Proposal

## What this is

Spark Studio is an internal tool that automates building client presentations.
Each department drops its source material — slides, spreadsheets, exports,
links to reporting dashboards — into a shared, per-client workspace. An AI
assistant reads that material (plus any notes a team types directly) and
either drafts full slides or helps refine a team's rough notes into
presentation-ready content. A single "Generate Presentation" step then
assembles every department's contributions into one branded deck, exportable
as a real PowerPoint file.

## Why

Today, presentation building is manual: each department maintains its own
slides, in its own format, pulled from its own tools (Looker, Hey Orca,
review platforms, vendor portals, SharePoint), and someone stitches it all
together by hand before every client meeting. Spark Studio's MVP goal is to
collapse that into: **drop your source material in your department's
folder → the AI does the first draft → you review and tweak.**

## How it's laid out today

- **Client workspace** — every client gets their own space; nothing is
  shared across clients.
- **Per-department folders** — each of the 6 departments below has its own
  file storage (`Files` tab) and its own slide queue (`Submit Slides` tab).
- **Global Files** — files relevant to *every* department (e.g. a client's
  brand guide) live here once and are visible to every department's AI
  assistant and to deck generation, instead of being duplicated per folder.
- **File types supported today**: Word doc (built-in editor), Excel sheet
  (built-in editor), raw file upload (PDF, CSV, images, etc., auto-read into
  AI context where possible), and external **link** (e.g. a SharePoint
  share link or — as of this proposal — any reporting dashboard link). Links
  are read automatically when the target is publicly fetchable; otherwise
  they're kept as a named reference so the AI still knows the source exists
  even if it can't read the live content (most internal dashboards require
  a Microsoft/Looker login, which a browser-only app can't do without a
  separate OAuth integration — see "Not in this MVP" below).
- **AI Assistant** — a per-department chat that sees that department's
  files + all Global Files, and can draft slide content from them.
- **Generate Presentation** — pulls every department's submitted slides,
  attaches each department's file context, and produces a complete,
  AI-assembled deck (cover, one section per contributing department,
  closing slide), live-previewable and exportable to `.pptx`.
- **Slide editor** — fullscreen mode, draggable/resizable content box,
  bold/italic rich text, multiple layouts (image-right, split, full-image,
  etc.), per-slide branding color/font overrides.

## What each department told us they need

This is the requirements checklist this MVP proposal adds as a visible
"what to upload" panel inside each department's Files tab, so every
contributor knows exactly what Spark Studio is expecting from them —
without needing this document.

### Marketing
- Latest slides from the data rundown / survey data
- Client Information Sheet (**new templated slide** — structured fields
  instead of free-form bullets, so this is consistent client to client)

### Social Media Marketing
- Year-over-year timeframe noted on anything pulled (so the AI knows the
  comparison period, not just the raw numbers)
- Hey Orca information
- Facebook / Instagram / LinkedIn data
- Review Tracker info — benchmark rating, and reviews-to-5-stars outcomes
- Looker report (dashboard link)
- Monitoring Playbook

### Digital
- Year-over-year timeframe noted on anything pulled
- Vendor platform data (job boards)
- Looker report (dashboard link)
- Geo-sheets breakdown
- Best performance: SEM Aware | SEM Interactive | Social Advertising

### Creative
- SharePoint access for images/videos used in creative/design slides
- Recommendations
- Creative Package Recap

### Client Services
- Year-over-year timeframe noted on anything pulled
- Access to all Looker reports, for review
- "My Team" slide (**new templated slide**)

### Product
- Agents Looker report (dashboard link)
- Lead Assist Looker report (dashboard link)

## What's in this MVP build

1. **Per-department requirements checklist** — the list above, shown
   directly in each department's Files tab (and Global Files, for anything
   shared), so contributors see exactly what's expected and can check items
   off as they add them. Pure UI/data — no new integration risk.
2. **Generalized external link type** — the link feature already shipped
   for SharePoint is relabeled/extended to cover any external dashboard
   link (Looker, Hey Orca, Review Tracker, vendor portals, geo-sheets),
   with a short label/category per link so it's clear what it is at a
   glance.
3. **Two new templated slides** — "Client Information Sheet" (Marketing)
   and "My Team" (Client Services), as structured-field slide types
   selectable from the slide editor, instead of relying on free-form
   bullets for things that should look the same every time.

## Explicitly not in this MVP (flagged, not forgotten)

- **Live data pulls from Looker, Hey Orca, review platforms, vendor
  portals, or SharePoint.** All of these require signing in as the user
  (OAuth) to read real content; this app currently has no backend and no
  Microsoft/Google/Looker app registration. The MVP treats these as
  **reference links** — the AI sees the link and what it's for, and a
  human still pulls the actual numbers in today, the same as the link
  feature shipped for SharePoint. Full live-data integration is a
  follow-on phase, scoped separately per-vendor since each has a different
  auth model (Microsoft Graph OAuth for SharePoint, Looker API key/OAuth
  for Looker, etc.) and most need a small backend to hold secrets safely.
- **Year-over-year as a first-class data structure.** This MVP captures the
  *timeframe as a note* on links/files; it does not yet compute or chart
  YoY deltas automatically.

## Open questions for approval

1. Are the two templated-slide field sets ("Client Information Sheet",
   "My Team") final, or do they need department sign-off on exact fields
   before being built?
2. For the requirements checklist — should an item being "unchecked" block
   `Generate Presentation`, or is it just a visual reminder with no hard
   gate?
3. Confirm priority order for the live-data integrations once this MVP
   ships (Looker is referenced by 4 of 6 departments — likely first).
