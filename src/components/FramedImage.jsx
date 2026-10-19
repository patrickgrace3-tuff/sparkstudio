import React from 'react'
import { fullRect } from '../lib/imageFrame.js'

// A cropped picture in its frame, drawn the way PowerPoint draws it. The frame
// is positioned in fractions of its parent; the parent must be a size
// container (containerType: 'inline-size') so rounded corners can be sized
// from the frame's shorter side. areaAspect = parent width / height.
export default function FramedImage({ img, areaAspect = 16 / 9, style, imgStyle, children }) {
  if (!img?.src) return null
  const radius = Math.max(0, Math.min(0.5, img.radius ?? 0)) * Math.min(img.w, img.h / areaAspect) * 100
  const legacyCover = img.mode === 'crop' && !img.crop
  const full = fullRect(img)
  return (
    <div style={{
      position: 'absolute',
      left: `${img.x * 100}%`, top: `${img.y * 100}%`,
      width: `${img.w * 100}%`, height: `${img.h * 100}%`,
      overflow: 'hidden', borderRadius: radius ? `${radius}cqw` : 0,
      ...style,
    }}>
      {legacyCover ? (
        <div style={{ position: 'absolute', inset: 0, background: `url(${img.src}) ${img.bgX ?? 50}% ${img.bgY ?? 50}% / cover no-repeat` }} />
      ) : (
        <img
          src={img.src} alt="" draggable={false}
          style={{
            position: 'absolute',
            left: `${((full.x - img.x) / img.w) * 100}%`, top: `${((full.y - img.y) / img.h) * 100}%`,
            width: `${(full.w / img.w) * 100}%`, height: `${(full.h / img.h) * 100}%`,
            maxWidth: 'none', maxHeight: 'none', userSelect: 'none', pointerEvents: 'none',
            ...imgStyle,
          }}
        />
      )}
      {children}
    </div>
  )
}
