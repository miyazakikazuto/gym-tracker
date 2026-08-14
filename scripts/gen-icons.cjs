// Generator ikon PWA murni Node (zlib + CRC32 manual), tanpa dependensi.
// Ikon: dumbell putih di kotak gradien #6366f1 -> #a78bfa.
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons')

let CRC_TABLE = null
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  CRC_TABLE = t
  return t
}
function crc32(buf) {
  const t = crcTable()
  let c = -1
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ t[(c ^ buf[i]) & 0xff]
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function writePng(file, w, h, rgba) {
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    const rowStart = y * (1 + w * 4)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * w * 4, (y + 1) * w * 4)
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', (() => {
      const b = Buffer.alloc(13)
      b.writeUInt32BE(w, 0)
      b.writeUInt32BE(h, 4)
      b[8] = 8 // bit depth
      b[9] = 6 // RGBA
      return b
    })()),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  fs.writeFileSync(file, png)
}

const C0 = [0x63, 0x66, 0xf1] // #6366f1
const C1 = [0xa7, 0x8b, 0xfa] // #a78bfa

// Persegi panjang membulat — dipakai untuk bar & plat dumbell (desain lebih modern)
function inRoundRect(u, v, cu, cv, hw, hh, r) {
  const au = Math.abs(u - cu)
  const av = Math.abs(v - cv)
  if (au > hw || av > hh) return false
  if (au <= hw - r || av <= hh - r) return true
  const du = au - (hw - r)
  const dv = av - (hh - r)
  return du * du + dv * dv <= r * r
}

function inGlyph(u, v) {
  // Bar utama (tebal, ujung membulat)
  if (inRoundRect(u, v, 0, 0, 0.28, 0.05, 0.05)) return true
  // Plat dalam (besar)
  if (inRoundRect(u, v, 0.38, 0, 0.075, 0.21, 0.06)) return true
  if (inRoundRect(u, v, -0.38, 0, 0.075, 0.21, 0.06)) return true
  // Plat luar (kecil)
  if (inRoundRect(u, v, 0.525, 0, 0.055, 0.14, 0.05)) return true
  if (inRoundRect(u, v, -0.525, 0, 0.055, 0.14, 0.05)) return true
  // Penutup ujung
  if (inRoundRect(u, v, 0.625, 0, 0.035, 0.078, 0.032)) return true
  if (inRoundRect(u, v, -0.625, 0, 0.035, 0.078, 0.032)) return true
  return false
}

function inRounded(x, y, s, r) {
  const half = s / 2
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  if (ax <= half - r || ay <= half - r) return true
  if (ax > half || ay > half) return false
  const dx = ax - (half - r)
  const dy = ay - (half - r)
  return dx * dx + dy * dy <= r * r
}

function draw(s, rounded, glyphScale, alpha) {
  const SS = 3
  const r = s * 0.22
  const gs = glyphScale
  const pix = Buffer.alloc(s * s * 4)
  const inv = 1 / (SS * SS)
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let a = 0
      let g = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          if (!rounded || inRounded(px - s / 2, py - s / 2, s, r)) a += 1
          // Normalisasi koordinat ke [-0.5, 0.5] — tanpa ini glyph nyaris tak terlihat
          const xc = ((px - s / 2) / s) * gs
          const yc = ((py - s / 2) / s) * gs
          const u = (xc + yc) * 0.70710678
          const v = (yc - xc) * 0.70710678
          if (inGlyph(u, v)) g += 1
        }
      }
      const i = (y * s + x) * 4
      const t = y / (s - 1)
      const rC = C0[0] + (C1[0] - C0[0]) * t
      const gC = C0[1] + (C1[1] - C0[1]) * t
      const bC = C0[2] + (C1[2] - C0[2]) * t
      const aF = (a * inv) * alpha
      const gF = g * inv
      pix[i] = Math.round(rC * (1 - gF) + 255 * gF)
      pix[i + 1] = Math.round(gC * (1 - gF) + 255 * gF)
      pix[i + 2] = Math.round(bC * (1 - gF) + 255 * gF)
      pix[i + 3] = Math.round(aF * 255)
    }
  }
  return pix
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

writePng(path.join(OUT_DIR, 'icon-192.png'), 192, 192, draw(192, true, 1, 1))
writePng(path.join(OUT_DIR, 'icon-512.png'), 512, 512, draw(512, true, 1, 1))
writePng(path.join(OUT_DIR, 'maskable-512.png'), 512, 512, draw(512, false, 0.85, 1))
writePng(path.join(OUT_DIR, 'apple-touch-icon.png'), 180, 180, draw(180, true, 1, 1))

console.log('icons written to ' + OUT_DIR)
