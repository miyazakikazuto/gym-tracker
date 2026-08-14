import { useState } from 'react'
import { useData } from '../context/DataContext'
import { todayKey } from '../lib/date'

export default function Settings() {
  const { exercises, plans, sessions, bodyweights, ready } = useData()
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')

  const finishedSessions = sessions.filter((s) => s.endedAt !== null).length

  function exportData() {
    try {
      const payload = {
        app: 'gym-tracker',
        type: 'backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        counts: {
          exercises: exercises.length,
          plans: plans.length,
          sessions: sessions.length,
          bodyweights: bodyweights.length,
        },
        exercises,
        plans,
        sessions,
        bodyweights,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gym-tracker-backup-${todayKey()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setState('done')
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="page">
      <div className="page-title">Pengaturan</div>
      <div className="subtitle">Backup & data</div>

      <div className="card">
        <div className="card-title">Backup data</div>
        <p className="small muted" style={{ margin: '0 0 8px' }}>
          Unduh semua data latihanmu ke satu file JSON — jadwal, sesi, gerakan, dan berat badan.
        </p>
        <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
          <span className="badge">{exercises.length} gerakan</span>
          <span className="badge">{plans.length} jadwal</span>
          <span className="badge">{sessions.length} sesi ({finishedSessions} selesai)</span>
          <span className="badge">{bodyweights.length} catatan berat</span>
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
          <button className="btn primary" disabled={!ready} onClick={exportData}>
            ⬇ Ekspor JSON
          </button>
          {state === 'done' && <span className="badge ok">✓ File tersimpan</span>}
          {state === 'error' && (
            <span className="badge" style={{ color: 'var(--danger)' }}>Gagal — coba lagi</span>
          )}
        </div>
        {!ready && <div className="small muted" style={{ marginTop: 8 }}>Memuat data…</div>}
      </div>
    </div>
  )
}
