// Input desimal yang tidak menelan titik/koma saat mengetik.
// Masalah yang diperbaiki: input controlled biasa (value={fmt} + parse tiap
// onChange) langsung memformat ulang — ketik "1," jadi "1", koma hilang,
// sehingga "2,29" mustahil diketik (berakhir "229").
// DecimalInput memegang TEKS draf lokal: tampilan tidak pernah diformat ulang
// saat mengetik; angka di-commit ke parent hanya bila teks tidak kosong dan
// parse valid. Teks kosong saat blur → kembali ke nilai terakhir.
import { useEffect, useRef, useState } from 'react'
import { parseDecimal } from '../lib/parse'
import { fmtInput } from '../lib/helpers'

interface Props {
  value: number // nilai angka dari luar (0 = kosong)
  onCommit: (n: number) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
}

export default function DecimalInput({ value, onCommit, placeholder, className, ariaLabel }: Props) {
  const [text, setText] = useState(value ? fmtInput(value) : '')
  const [dirty, setDirty] = useState(false)
  const lastExternal = useRef(value)

  // Sinkron dari luar hanya bila berubah dari luar (bukan dari ketikan sendiri)
  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value
      if (!dirty) setText(value ? fmtInput(value) : '')
    }
  }, [value, dirty])

  return (
    <input
      className={className ?? 'wt'}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => {
        const next = e.target.value
        setText(next)
        setDirty(true)
        lastExternal.current = value
        const trimmed = next.trim()
        if (trimmed === '') return // kosong → jangan commit 0
        const n = parseDecimal(trimmed)
        if (n !== null) {
          lastExternal.current = n
          onCommit(n)
        }
      }}
      onBlur={() => {
        setDirty(false)
        // Teks kosong / tidak valid saat keluar → tampilkan nilai terakhir
        if (text.trim() === '' || parseDecimal(text.trim()) === null) {
          setText(value ? fmtInput(value) : '')
        }
      }}
    />
  )
}
