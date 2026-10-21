// Pictures on slides work like PowerPoint's: a frame on the slide (x, y, w, h —
// fractions of the area the picture sits in) showing part of the picture.
// crop = { l, t, r, b } is how much of the picture (fractions of its own width
// and height) is cut off each side; radius rounds the frame's corners (fraction
// of its shorter side, 0–0.5). The picture is never distorted by cropping.

export const NO_CROP = { l: 0, t: 0, r: 0, b: 0 }

export function cropOf(img) {
  const c = Array.isArray(img?.crop) ? { l: img.crop[0], t: img.crop[1], r: img.crop[2], b: img.crop[3] } : img?.crop
  return {
    l: +c?.l || 0, t: +c?.t || 0,
    r: +c?.r || 0, b: +c?.b || 0,
  }
}

// The whole (uncropped) picture's rectangle, in the frame's units
export function fullRect(img) {
  const c = cropOf(img)
  const vw = Math.max(1e-6, 1 - c.l - c.r), vh = Math.max(1e-6, 1 - c.t - c.b)
  const fw = img.w / vw, fh = img.h / vh
  return { x: img.x - c.l * fw, y: img.y - c.t * fh, w: fw, h: fh }
}

// Frame + whole-picture rectangle → crop
export function cropFrom(frame, full) {
  return {
    l: (frame.x - full.x) / full.w,
    t: (frame.y - full.y) / full.h,
    r: (full.x + full.w - (frame.x + frame.w)) / full.w,
    b: (full.y + full.h - (frame.y + frame.h)) / full.h,
  }
}

export const hasCrop = img => {
  const c = cropOf(img)
  return c.l > 1e-4 || c.t > 1e-4 || c.r > 1e-4 || c.b > 1e-4
}

// Older images cropped with "crop mode" (CSS cover + bgX/bgY position) → crop.
// areaAspect is the width/height of the area the frame fractions refer to.
export function legacyCrop(img, natW, natH, areaAspect = 16 / 9) {
  if (img?.mode !== 'crop' || img.crop || !natW || !natH) return null
  const boxAspect = (img.w * areaAspect) / img.h
  const picAspect = natW / natH
  const bx = (img.bgX ?? 50) / 100, by = (img.bgY ?? 50) / 100
  if (picAspect > boxAspect) {
    const cut = 1 - boxAspect / picAspect
    return { l: cut * bx, t: 0, r: cut * (1 - bx), b: 0 }
  }
  const cut = 1 - picAspect / boxAspect
  return { l: 0, t: cut * by, r: 0, b: cut * (1 - by) }
}

// Turns an older image entry into the current form (needs the picture's size)
export function upgradeImage(img, natW, natH, areaAspect = 16 / 9) {
  if (!img) return img
  const crop = img.crop ? cropOf(img) : legacyCrop(img, natW, natH, areaAspect) ?? NO_CROP
  const { mode: _m, bgX: _x, bgY: _y, ...rest } = img
  return { ...rest, crop, ...(natW && natH ? { aspect: natW / natH } : {}) }
}

// Width/height in pixels of a data URL picture (PNG, JPEG, GIF), or null
export function imageSizeFromDataUrl(dataUrl) {
  const m = /^data:[^;]+;base64,(.*)$/.exec(dataUrl ?? '')
  if (!m) return null
  let bin
  try { bin = atob(m[1].slice(0, 200000)) } catch { return null }
  const at = i => bin.charCodeAt(i)
  const u16 = i => (at(i) << 8) | at(i + 1)
  const u32 = i => ((at(i) << 24) | (at(i + 1) << 16) | (at(i + 2) << 8) | at(i + 3)) >>> 0
  if (bin.startsWith('\x89PNG')) return { w: u32(16), h: u32(20) }
  if (bin.startsWith('GIF')) return { w: at(6) | (at(7) << 8), h: at(8) | (at(9) << 8) }
  if (at(0) === 0xff && at(1) === 0xd8) {
    let i = 2
    while (i < bin.length - 9) {
      if (at(i) !== 0xff) { i++; continue }
      const marker = at(i + 1)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: u16(i + 7), h: u16(i + 5) }
      i += 2 + u16(i + 2)
    }
  }
  return null
}

export function loadImageSize(src) {
  return new Promise(resolve => {
    const el = new window.Image()
    el.onload = () => resolve({ w: el.naturalWidth, h: el.naturalHeight })
    el.onerror = () => resolve(null)
    el.src = src
  })
}

// Crop that makes a picture fill a frame of the given shape (width/height in
// pixels) without stretching, cut evenly from both sides — like PowerPoint's
// Change Picture
export function coverCrop(natW, natH, frameAspect) {
  if (!natW || !natH || !frameAspect) return { ...NO_CROP }
  const picAspect = natW / natH
  if (picAspect > frameAspect) {
    const cut = (1 - frameAspect / picAspect) / 2
    return { l: cut, t: 0, r: cut, b: 0 }
  }
  const cut = (1 - picAspect / frameAspect) / 2
  return { l: 0, t: cut, r: 0, b: cut }
}

// A picture file → { src (data URL), w, h }. Very large pictures are scaled
// down (to 2560px) so slides stay quick to save and load.
export async function readPictureFile(file, maxDim = 2560) {
  const dataUrl = await new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result)
    fr.onerror = () => rej(fr.error)
    fr.readAsDataURL(file)
  })
  const size = await loadImageSize(dataUrl)
  if (!size) throw new Error('This file could not be read as a picture.')
  const keepAsIs = Math.max(size.w, size.h) <= maxDim && /^data:image\/(png|jpeg|gif)/.test(dataUrl)
  if (keepAsIs) return { src: dataUrl, w: size.w, h: size.h }
  const scale = Math.min(1, maxDim / Math.max(size.w, size.h))
  const img = new window.Image()
  await new Promise(r => { img.onload = r; img.src = dataUrl })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size.w * scale)
  canvas.height = Math.round(size.h * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  const png = /^data:image\/png/.test(dataUrl)
  return { src: canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.92), w: canvas.width, h: canvas.height }
}
