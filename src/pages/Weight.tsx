import { useEffect, useRef, useState } from 'react'
import { useData } from '../context/DataContext'
import { todayKey, addDays } from '../lib/date'
import { fmtNumber } from '../lib/helpers'
import { parseDecimal } from '../lib/parse'
import { dotsScore, fmtDots, dotsLevel } from '../lib/dots'
import { sbdBestLifts } from '../lib/sbd'
import Modal from '../components/Modal'
import LineChart from '../components/LineChart'
import type { Bodyweight } from '../types'

const RANGES = [
  { key: '7', label: '7 hari' },
  { key: '30', label: '30 hari' },
  { key: 'all', label: 'Semua' },
] as const
type RangeKey = (typeof RANGES)[number]['key']

// Selisih berat terakhir vs entri terdekat ≤ N hari lalu (null jika belum cukup data)
function deltaKg(entries: Bodyweight[], daysAgo: number, today: string): number | null {
  if (entries.length === 0) return null
  const from = addDays(today, -daysAgo)
  const prev = [...entries].reverse().find((b) => b.date <= from)
  if (!prev) return null
  return Math.round((entries[entries.length - 1].kg - prev.kg) * 100) / 100
}

function DeltaStat({ label, val }: { label: string; val: number | null }) {
  return (
    <div className="stat">
      <div className={'v' + (val == null ? '' : val > 0 ? ' up' : val < 0 ? ' down' : '')}>
        {val == null ? '—' : (val > 0 ? '+' : '') + fmtNumber(val) + ' kg'}
      </div>
      <div className="l">{label}</div>
    </div>
  )
}

export default function Weight() {
  const { sessions, exercises, bodyweights, settings, saveSettings, saveBodyweight, removeBodyweight } = useData()

  const sortedBw = [...bodyweights].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const latestKg = sortedBw.length > 0 ? sortedBw[sortedBw.length - 1].kg : null
  const latestDate = sortedBw.length > 0 ? sortedBw[sortedBw.length - 1].date : null
  const [dotsBw, setDotsBw] = useState<string>(latestKg ? String(latestKg) : '')
  const [dotsDirty, setDotsDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle')
  const saveTimer = useRef<number | undefined>(undefined)
  const autoSaveTimer = useRef<number | undefined>(undefined)

  const today = todayKey()

  // Filter rentang untuk grafik & daftar
  const [range, setRange] = useState<RangeKey>('30')
  const rangeStart = range === '7' ? addDays(today, -6) : range === '30' ? addDays(today, -29) : null
  const filteredBw = rangeStart ? sortedBw.filter((b) => b.date >= rangeStart) : sortedBw
  const [visibleCount, setVisibleCount] = useState(15)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  // Target berat badan
  const [showTarget, setShowTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')
  const target = typeof settings.weightTarget === 'number' ? settings.weightTarget : null
  const targetBase = typeof settings.weightTargetBase === 'number' ? settings.weightTargetBase : null
  const targetDiff = target != null && latestKg != null ? Math.round((latestKg - target) * 100) / 100 : null
  // Kemajuan menuju target (baseline = berat saat target diset); fallback rasio jika tanpa baseline
  const targetPct = (() => {
    if (target == null || latestKg == null) return null
    if (targetBase != null && targetBase !== target) {
      const pct = target < targetBase
        ? ((targetBase - latestKg) / (targetBase - target)) * 100
        : ((latestKg - targetBase) / (target - targetBase)) * 100
      return Math.min(100, Math.max(0, Math.round(pct)))
    }
    return Math.min(100, Math.round((latestKg / target) * 100))
  })()

  // Ringkasan: delta & min/max 30 hari
  const delta7 = deltaKg(sortedBw, 7, today)
  const delta30 = deltaKg(sortedBw, 30, today)
  const win30 = sortedBw.filter((b) => b.date >= addDays(today, -29))
  const min30 = win30.length > 0 ? Math.min(...win30.map((b) => b.kg)) : null
  const max30 = win30.length > 0 ? Math.max(...win30.map((b) => b.kg)) : null

  // Label tanggal terakhir — sertakan tahun hanya jika beda dari tahun berjalan
  const lastDateLabel = (() => {
    if (!latestDate) return ''
    const d = latestDate.slice(8, 10) + '/' + latestDate.slice(5, 7)
    return latestDate.slice(0, 4) === today.slice(0, 4) ? d : d + '/' + latestDate.slice(0, 4)
  })()

  const parseKg = (raw: string): number | null => {
    const parsed = parseDecimal(raw)
    return parsed != null && parsed > 0 ? Math.round(parsed * 100) / 100 : null
  }

  const doSave = () => {
    // Batalkan autosave yang tertunda — mencegah double-write
    window.clearTimeout(autoSaveTimer.current)
    const kg = parseKg(dotsBw)
    if (kg == null) {
      setSaveState('err')
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => setSaveState('idle'), 2000)
      return
    }
    setSaveState('saving')
    saveBodyweight(todayKey(), kg)
      .then(() => {
        setDotsDirty(false)
        setSaveState('ok')
        window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => setSaveState('idle'), 2000)
      })
      .catch(() => {
        setSaveState('err')
        window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => setSaveState('idle'), 4000)
      })
  }

  // Sinkron dari log (perangkat lain) — hanya saat user tidak sedang mengetik
  useEffect(() => {
    if (latestKg == null || dotsDirty) return
    setDotsBw(String(latestKg))
  }, [latestKg, dotsDirty])

  // Autosave debounce (500ms) — bisa dibatalkan dari doSave (mencegah double-write)
  useEffect(() => {
    if (!dotsDirty) return
    const kg = parseKg(dotsBw)
    if (kg == null) return
    window.clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = window.setTimeout(() => {
      saveBodyweight(todayKey(), kg)
        .then(() => setDotsDirty(false))
        .catch(() => undefined)
    }, 500)
    return () => window.clearTimeout(autoSaveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dotsBw, dotsDirty])

  const sbdLifts = sbdBestLifts(sessions, exercises)
  const dotsTotal = sbdLifts.reduce((sum, l) => sum + l.best, 0)
  const bwParsed = parseFloat(dotsBw.replace(',', '.'))
  const bwValid = Number.isFinite(bwParsed) && bwParsed > 0
  const dotsVal = dotsTotal > 0 && bwValid ? dotsScore(dotsTotal, bwParsed) : null
  const lvl = dotsVal != null ? dotsLevel(dotsVal) : null

  const sbdBreakdown = (
    <div className="row" style={{ gap: 8, marginTop: 8 }}>
      {sbdLifts.map((l) => (
        <div key={l.key} style={{ flex: 1, background: 'var(--bg2)', borderRadius: 10, padding: '8px 10px' }}>
          <div className="small muted">{l.label}</div>
          <div style={{ fontWeight: 700 }}>{l.best > 0 ? '~' + fmtNumber(l.best) + ' kg' : '—'}</div>
          <div className="small muted" style={{ fontSize: 10, marginTop: 2 }}>
            {l.best > 0 && l.date ? 'PR ' + l.date.slice(8, 10) + '/' + l.date.slice(5, 7) + '/' + l.date.slice(0, 4) : 'Belum ada data'}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="page">
      <div className="page-title">Berat Badan</div>

      <div className="card">
        <div className="card-title">DOTS Score</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v5" />
            <circle cx="12" cy="11" r="3" />
            <path d="M6.5 21L5 12.5a8.4 8.4 0 0 1 14 0L17.5 21" />
            <path d="M4 21h16" />
          </svg>
          <input
            className="input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Berat hari ini (kg)"
            value={dotsBw}
            onChange={(e) => { setDotsBw(e.target.value); setDotsDirty(true) }}
            onBlur={() => { if (dotsDirty) doSave() }}
            onKeyDown={(e) => { if (e.key === 'Enter') doSave() }}
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '8px 4px', fontSize: 18, fontWeight: 700 }}
          />
          <span style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 15 }}>kg</span>
        </div>
        <div className="row spread wrap" style={{ marginTop: 6, marginBottom: 10, gap: 8 }}>
          <span className="small muted">
            Hari ini · {todayKey().slice(8, 10) + '/' + todayKey().slice(5, 7) + '/' + todayKey().slice(0, 4)} · otomatis saat mengetik
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm primary" onClick={doSave} disabled={saveState === 'saving'}>Simpan</button>
            {saveState === 'saving' && <span className="small muted">Menyimpan…</span>}
            {saveState === 'ok' && <span className="small" style={{ color: 'var(--ok)' }}>Tersimpan ✓</span>}
            {saveState === 'err' && <span className="small" style={{ color: 'var(--danger)' }}>Gagal menyimpan</span>}
          </div>
        </div>

        {dotsTotal <= 0 ? (
          <>
            <div className="small muted">
              Belum ada data SBD. Catat Squat, Bench Press, dan Deadlift dengan beban & reps untuk melihat DOTS Score.
            </div>
            {sbdBreakdown}
          </>
        ) : !bwValid ? (
          <>
            <div className="small muted">Isi berat badan (kg) dulu untuk menghitung DOTS Score.</div>
            {sbdBreakdown}
          </>
        ) : (
          <>
            <div className="pr" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <div>
                <div style={{ fontWeight: 800 }}>
                  DOTS Score
                  {lvl && (
                    <span className="badge" style={{ marginLeft: 8, color: lvl.color, background: 'rgba(255,255,255,.07)' }}>
                      {lvl.label}
                    </span>
                  )}
                </div>
                <div className="small muted">
                  Total SBD ~{fmtNumber(dotsTotal)} kg (beban terberat per lift) @ {fmtNumber(bwParsed)} kg BW
                </div>
              </div>
              <div className="val" style={{ fontSize: 24 }}>{fmtDots(dotsVal ?? 0)}</div>
            </div>
            {sbdBreakdown}
            <div className="small muted" style={{ marginTop: 8 }}>
              Standar DOTS (Mike Tuchscherer) — skor yang menormalkan total angkatan terhadap berat badan. Level: Pemula &lt;250 · Novis 250+ · Menengah 300+ · Lanjut 350+ · Elit 400+.
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <span>Ringkasan</span>
          <button className="btn sm ghost" onClick={() => { setTargetInput(target ? String(target) : ''); setShowTarget(true) }}>
            {target ? `Target ${fmtNumber(target)} kg` : 'Atur target'}
          </button>
        </div>
        {sortedBw.length === 0 ? (
          <div className="small muted">Belum ada data — catat berat hari ini di kotak di atas.</div>
        ) : (
          <>
            <div className="stat-row">
              <div className="stat">
                <div className="v">{fmtNumber(latestKg ?? 0)} kg</div>
                <div className="l">Terakhir · {lastDateLabel}</div>
              </div>
              <DeltaStat label="Δ 7 hari" val={delta7} />
              <DeltaStat label="Δ 30 hari" val={delta30} />
            </div>
            <div className="small muted">
              Min {min30 == null ? '—' : fmtNumber(min30) + ' kg'} · Max {max30 == null ? '—' : fmtNumber(max30) + ' kg'} (30 hari)
            </div>
            {target != null && latestKg != null && targetDiff !== null && (
              <div style={{ marginTop: 10 }}>
                <div className="row spread" style={{ marginBottom: 4 }}>
                  <span className="small muted">
                    {targetDiff === 0
                      ? 'Target tercapai ✓'
                      : targetDiff > 0
                        ? `Kelebihan ${fmtNumber(targetDiff)} kg dari target`
                        : `Tinggal ${fmtNumber(-targetDiff)} kg lagi ke target`}
                  </span>
                  <span className="small muted">{fmtNumber(latestKg)} / {fmtNumber(target)} kg</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: (targetPct ?? 0) + '%' }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">Log Berat Badan</div>
        <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
          {RANGES.map((r) => (
            <button key={r.key} className={'chipb' + (range === r.key ? ' on' : '')} onClick={() => { setRange(r.key); setVisibleCount(15) }}>
              {r.label}
            </button>
          ))}
        </div>
        {sortedBw.length === 0 ? (
          <div className="small muted">
            Belum ada catatan berat badan. Isi kotak di atas untuk mencatat berat hari ini.
          </div>
        ) : (
          <>
            <div className="pr trend">
              <LineChart data={filteredBw} target={target} />
            </div>
            <div className="pr-list" style={{ marginTop: 8 }}>
              {[...filteredBw].reverse().slice(0, visibleCount).map((b) => (
                <div className="pr" key={b.id} style={{ padding: '8px 0' }}>
                  <div className="small muted">{b.date.slice(8, 10) + '/' + b.date.slice(5, 7) + '/' + b.date.slice(0, 4)}</div>
                  <div className="val" style={{ fontSize: 14 }}>{fmtNumber(b.kg)} kg</div>
                  <button className="icon-btn danger" aria-label={`Hapus penimbangan ${b.date}`} onClick={() => setConfirmDel(b.date)}>✕</button>
                </div>
              ))}
            </div>
            {filteredBw.length > visibleCount && (
              <button className="btn ghost wide" style={{ marginTop: 8 }} onClick={() => setVisibleCount((c) => c + 15)}>
                Tampilkan lebih banyak ({filteredBw.length - visibleCount} sisanya)
              </button>
            )}
          </>
        )}
      </div>

      {showTarget && (
        <Modal onClose={() => setShowTarget(false)} label="Target berat badan">
          <h3>Target berat badan</h3>
          <div className="small muted" style={{ marginBottom: 10 }}>
            Isi target (kg). Kosongkan lalu Simpan untuk menghapus target.
          </div>
          <input
            className="input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Target (kg)"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
          />
          <div className="form-actions">
            <button className="btn ghost" onClick={() => setShowTarget(false)}>Batal</button>
            <button
              className="btn primary"
              onClick={() => {
                const raw = targetInput.trim()
                if (raw === '') {
                  saveSettings({ weightTarget: null, weightTargetBase: null })
                } else {
                  const kg = parseKg(raw)
                  if (kg != null) {
                    const base = target == null && latestKg != null ? latestKg : (settings.weightTargetBase ?? null)
                    saveSettings({ weightTarget: kg, weightTargetBase: base })
                  }
                }
                setShowTarget(false)
              }}
            >
              Simpan
            </button>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)} label="Hapus penimbangan">
          <h3>Hapus penimbangan?</h3>
          <div className="small muted" style={{ marginBottom: 10 }}>
            {(() => {
              const b = sortedBw.find((x) => x.date === confirmDel)
              return (b ? fmtNumber(b.kg) + ' kg' : 'Entri') + ' tanggal ' + confirmDel.slice(8, 10) + '/' + confirmDel.slice(5, 7) + '/' + confirmDel.slice(0, 4) + ' akan dihapus.'
            })()}
          </div>
          <div className="form-actions">
            <button className="btn ghost" onClick={() => setConfirmDel(null)}>Batal</button>
            <button className="btn danger" onClick={() => { removeBodyweight(confirmDel); setConfirmDel(null) }}>Hapus</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
