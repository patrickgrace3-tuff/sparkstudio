// Reads the picture out of an EMF file so it can be shown in the browser.
//
// Office saves pasted or copied pictures as EMF files that wrap a single
// bitmap: either an EMF+ image object (GDI+) or a classic DIB record. This
// pulls out the largest bitmap and turns it into a PNG data URL. EMFs made of
// vector drawing commands only aren't supported (→ null). The original EMF is
// still what goes into the export.

const EMR_COMMENT = 70
const EMR_BITBLT = 76
const EMR_STRETCHBLT = 77
const EMR_STRETCHDIBITS = 81
const EMR_EOF = 14
const EMFPLUS_OBJECT = 0x4008
const OBJECT_IMAGE = 5

// GDI+ pixel formats
const PF_32_PARGB = 0x000e200b
const PF_32_ARGB = 0x0026200a
const PF_32_RGB = 0x00022009
const PF_24_RGB = 0x00021808

export async function emfToDataUrl(bytes) {
  try {
    const picture = largestPicture(bytes)
    if (!picture) return null
    if (picture.encoded) return await blobToDataUrl(new Blob([picture.encoded]))
    const canvas = document.createElement('canvas')
    canvas.width = picture.w
    canvas.height = picture.h
    canvas.getContext('2d').putImageData(new ImageData(picture.rgba, picture.w, picture.h), 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

function largestPicture(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (dv.byteLength < 88 || dv.getUint32(0, true) !== 1 || dv.getUint32(40, true) !== 0x464d4520) return null // " EMF"
  const found = []
  let pending = null // an EMF+ object split over several records
  let i = 0
  while (i + 8 <= dv.byteLength) {
    const type = dv.getUint32(i, true), size = dv.getUint32(i + 4, true)
    if (size < 8 || i + size > dv.byteLength) break
    if (type === EMR_COMMENT && size >= 16 && dv.getUint32(i + 12, true) === 0x2b464d45) { // "EMF+"
      const end = i + 12 + dv.getUint32(i + 8, true)
      let j = i + 16
      while (j + 12 <= end) {
        const rt = dv.getUint16(j, true), flags = dv.getUint16(j + 2, true)
        const recSize = dv.getUint32(j + 4, true), dataSize = dv.getUint32(j + 8, true)
        if (recSize < 12 || j + recSize > end) break
        if (rt === EMFPLUS_OBJECT && ((flags >> 8) & 0x7f) === OBJECT_IMAGE) {
          if (flags & 0x8000) { // continued: 4-byte total size, then a piece of the object
            const total = dv.getUint32(j + 12, true)
            if (!pending || pending.id !== (flags & 0xff)) pending = { id: flags & 0xff, buf: new Uint8Array(total), at: 0 }
            const piece = bytes.subarray(j + 16, j + 12 + dataSize)
            pending.buf.set(piece.subarray(0, pending.buf.length - pending.at), pending.at)
            pending.at += piece.length
            if (pending.at >= pending.buf.length) { addPlusImage(pending.buf, found); pending = null }
          } else {
            addPlusImage(bytes.subarray(j + 12, j + 12 + dataSize), found)
          }
        }
        j += recSize
      }
    } else if (type === EMR_STRETCHDIBITS || type === EMR_BITBLT || type === EMR_STRETCHBLT) {
      // Offsets of the bitmap header and bits within the record
      const o = type === EMR_STRETCHDIBITS ? { bmi: 48, cbBmi: 52, bits: 56, cbBits: 60 } : { bmi: 84, cbBmi: 88, bits: 92, cbBits: 96 }
      if (size >= o.cbBits + 4) {
        const offBmi = dv.getUint32(i + o.bmi, true), cbBmi = dv.getUint32(i + o.cbBmi, true)
        const offBits = dv.getUint32(i + o.bits, true), cbBits = dv.getUint32(i + o.cbBits, true)
        if (cbBmi && cbBits && offBmi + cbBmi <= size && offBits + cbBits <= size) {
          addDib(bytes.subarray(i + offBmi, i + offBmi + cbBmi), bytes.subarray(i + offBits, i + offBits + cbBits), found)
        }
      }
    } else if (type === EMR_EOF) break
    i += size
  }
  if (!found.length) return null
  return found.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a))
}

// EmfPlusImage: version, type (1 = bitmap), then EmfPlusBitmap
function addPlusImage(data, found) {
  if (data.length < 28) return
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (dv.getUint32(4, true) !== 1) return // metafile images aren't handled
  const w = dv.getInt32(8, true), h = dv.getInt32(12, true), stride = dv.getInt32(16, true)
  const format = dv.getUint32(20, true), kind = dv.getUint32(24, true)
  const pixels = data.subarray(28)
  if (kind === 1) { found.push({ w: Math.max(1, w), h: Math.max(1, h), encoded: pixels }); return } // PNG/JPEG/GIF…
  if (w <= 0 || h <= 0 || w * h > 40e6) return
  const rgba = new Uint8ClampedArray(w * h * 4)
  const bpp = format === PF_24_RGB ? 3 : 4
  if (![PF_32_PARGB, PF_32_ARGB, PF_32_RGB, PF_24_RGB].includes(format) || Math.abs(stride) * h > pixels.length) return
  for (let y = 0; y < h; y++) {
    const row = stride > 0 ? y * stride : (h - 1 - y) * -stride
    for (let x = 0; x < w; x++) {
      const s = row + x * bpp, d = (y * w + x) * 4
      let b = pixels[s], g = pixels[s + 1], r = pixels[s + 2]
      let a = bpp === 4 && format !== PF_32_RGB ? pixels[s + 3] : 255
      if (format === PF_32_PARGB && a > 0 && a < 255) { r = (r * 255) / a; g = (g * 255) / a; b = (b * 255) / a }
      rgba[d] = r; rgba[d + 1] = g; rgba[d + 2] = b; rgba[d + 3] = a
    }
  }
  found.push({ w, h, rgba })
}

// Classic DIB (BITMAPINFOHEADER + bits): 24/32-bit uncompressed, or PNG/JPEG
function addDib(bmi, bits, found) {
  if (bmi.length < 40) return
  const dv = new DataView(bmi.buffer, bmi.byteOffset, bmi.byteLength)
  const w = dv.getInt32(4, true), hRaw = dv.getInt32(8, true), bitCount = dv.getUint16(14, true), compression = dv.getUint32(16, true)
  const h = Math.abs(hRaw)
  if (compression === 4 || compression === 5) { found.push({ w, h, encoded: bits }); return } // BI_JPEG / BI_PNG
  if (w <= 0 || !h || w * h > 40e6 || ![24, 32].includes(bitCount) || ![0, 3].includes(compression)) return
  const bpp = bitCount / 8, stride = Math.ceil((w * bpp) / 4) * 4
  if (stride * h > bits.length) return
  const rgba = new Uint8ClampedArray(w * h * 4)
  let anyAlpha = false
  if (bpp === 4) for (let k = 3; k < stride * h; k += 4) if (bits[k]) { anyAlpha = true; break }
  for (let y = 0; y < h; y++) {
    const row = hRaw > 0 ? (h - 1 - y) * stride : y * stride // bottom-up unless the height is negative
    for (let x = 0; x < w; x++) {
      const s = row + x * bpp, d = (y * w + x) * 4
      rgba[d] = bits[s + 2]; rgba[d + 1] = bits[s + 1]; rgba[d + 2] = bits[s]
      rgba[d + 3] = bpp === 4 && anyAlpha ? bits[s + 3] : 255
    }
  }
  found.push({ w, h, rgba })
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result)
    fr.onerror = () => rej(fr.error)
    fr.readAsDataURL(blob)
  })
}
