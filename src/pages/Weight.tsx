import { useEffect, useState } from 'react'
import { useData } from '../context/DataContext'
import { todayKey } from '../lib/date'
import { fmtNumber } from '../lib/helpers'
import { dotsScore, fmtDots } from '../lib/dots'
import { sbdBestLifts } from '../lib/sbd'

export default function Weight() {
  const { sessions, exercises, bodyweights, saveBodyweight, removeBodyweight } = useData()

  const sortedBw = [...bodyweights].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const latestKg = sortedBw.length > 0 ? sortedBw[sortedBw.length - 1].kg : null
  const [dotsBw, setDotsBw] = useState<string>(latestKg ? String(latestKg) : '')
  const [dotsDirty, setDotsDirty] = useState(false)

  // Sinkron dari log (perangkat lain) — hanya saat user tidak sedang mengetik
  useEffect(() => {
    if (latestKg == null || dotsDirty) return
    setDotsBw(String(latestKg))
  }, [latestKg, dotsDirty])

  // Autosave debounce (500ms) — mencatat entri berat hari ini, hanya setelah user mengetik
  useEffect(() => {
    if (!dotsDirty) return
    const parsed = parseFloat(dotsBw.replace(',', '.'))
    if (!(Number.isFinite(parsed) && parsed > 0)) return
    const kg = Math.round(parsed * 100) / 100
    const t = setTimeout(() => saveBodyweight(todayKey(), kg), 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dotsBw, dotsDirty])

  const sbdLifts = sbdBestLifts(sessions, exercises)
  const dotsTotal = sbdLifts.reduce((sum, l) => sum + l.best, 0)
  const bwParsed = parseFloat(dotsBw.replace(',', '.'))
  const bwValid = Number.isFinite(bwParsed) && bwParsed > 0
  const dotsVal = dotsTotal > 0 && bwValid ? dotsScore(dotsTotal, bwParsed) : null

  const sbdBreakdown = (
    <div className="row" style={{ gap: 8, marginTop: 8 }}>
      {sbdLifts.map((l) => (
        <div key={l.key} style={{ flex: 1, background: 'var(--bg2)', borderRadius: 10, padding: '8px 10px' }}>
          <div className="small muted">{l.label}</div>
          <div style={{ fontWeight: 700 }}>{l.best > 0 ? '~' + fmtNumber(l.best) + ' kg' : '—'}</div>
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
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '8px 4px', fontSize: 18, fontWeight: 700 }}
          />
          <span style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 15 }}>kg</span>
        </div>
        <div className="small muted" style={{ marginTop: 6, marginBottom: 10 }}>
          Hari ini · {todayKey().slice(8, 10) + '/' + todayKey().slice(5, 7) + '/' + todayKey().slice(0, 4)} · tersimpan otomatis
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
                <div style={{ fontWeight: 800 }}>DOTS Score</div>
                <div className="small muted">
                  Total SBD ~{fmtNumber(dotsTotal)} kg (beban terberat per lift) @ {fmtNumber(bwParsed)} kg BW
                </div>
              </div>
              <div className="val" style={{ fontSize: 24 }}>{fmtDots(dotsVal ?? 0)}</div>
            </div>
            {sbdBreakdown}
            <div className="small muted" style={{ marginTop: 8 }}>
              Standar DOTS (Mike Tuchscherer) — skor yang menormalkan total angkatan terhadap berat badan.
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">Log Berat Badan</div>
        {sortedBw.length === 0 ? (
          <div className="small muted">
            Belum ada catatan berat badan. Isi kotak di atas untuk mencatat berat hari ini.
          </div>
        ) : (
          <>
            <div className="pr trend">
              <div style={{ flex: 1 }}>
                <div className="trend-val">
                  <span style={{ fontWeight: 700 }}>12 penimbangan terakhir</span>
                  <span>
                    <span className="val" style={{ fontSize: 14 }}>{fmtNumber(sortedBw[sortedBw.length - 1].kg)} kg</span>
                  </span>
                </div>
                <div className="trend-bars">
                  {(() => {
                    const window = sortedBw.slice(-12)
                    const max = Math.max(...window.map((b) => b.kg), 1)
                    return window.map((b, i) => (
                      <div
                        key={b.id}
                        className={'trend-bar' + (i === window.length - 1 ? ' now' : '')}
                        style={{ height: Math.max(4, (b.kg / max) * 100) + '%' }}
                        title={b.date + ' — ' + fmtNumber(b.kg) + ' kg'}
                      />
                    ))
                  })()}
                </div>
              </div>
            </div>
            <div className="pr-list" style={{ marginTop: 8 }}>
              {[...sortedBw].reverse().slice(0, 15).map((b) => (
                <div className="pr" key={b.id} style={{ padding: '8px 0' }}>
                  <div className="small muted">{b.date.slice(8, 10) + '/' + b.date.slice(5, 7) + '/' + b.date.slice(0, 4)}</div>
                  <div className="val" style={{ fontSize: 14 }}>{fmtNumber(b.kg)} kg</div>
                  <button className="icon-btn danger" onClick={() => { if (confirm('Hapus penimbangan ' + b.date + '?')) removeBodyweight(b.date) }}>✕</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}