import { useRef, useState } from 'react'
import { useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { todayKey } from '../lib/date'
import { importBackup } from '../lib/gymstore'
import type { Exercise, WorkoutPlan, Session, Bodyweight } from '../types'

interface BackupPayload {
  app?: string
  type?: string
  version?: number
  exercises?: unknown[]
  plans?: unknown[]
  sessions?: unknown[]
  bodyweights?: unknown[]
}

export default function Settings() {
  const uid = useUid()
  const { exercises, plans, sessions, bodyweights, ready } = useData()
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')
  const [importState, setImportState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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

  async function importFile(file: File) {
    setImportState('busy')
    setImportMsg('')
    try {
      const text = await file.text()
      const data = JSON.parse(text) as BackupPayload
      if (
        !data ||
        typeof data !== 'object' ||
        !Array.isArray(data.exercises) ||
        !Array.isArray(data.plans) ||
        !Array.isArray(data.sessions) ||
        !Array.isArray(data.bodyweights)
      ) {
        throw new Error('File bukan backup Gym Tracker yang valid')
      }
      const exs = data.exercises.filter((x) => x && typeof (x as { id?: unknown }).id === 'string') as Exercise[]
      const pls = data.plans.filter((x) => x && typeof (x as { id?: unknown }).id === 'string') as WorkoutPlan[]
      const ses = data.sessions.filter((x) => x && typeof (x as { id?: unknown }).id === 'string') as Session[]
      const bws = data.bodyweights.filter(
        (x) => x && typeof (x as { date?: unknown }).date === 'string' && typeof (x as { kg?: unknown }).kg === 'number',
      ) as Bodyweight[]

      if (!confirm('Import akan menimpa data yang ID-nya sama dengan backup. Lanjutkan?')) {
        setImportState('idle')
        return
      }

      const total = await importBackup(uid, { exercises: exs, plans: pls, sessions: ses, bodyweights: bws })
      setImportState('done')
      setImportMsg(
        total === 0
          ? 'Tidak ada data valid di file ini'
          : `✓ ${exs.length} gerakan, ${pls.length} jadwal, ${ses.length} sesi, ${bws.length} berat diimpor (${total} tulis)`,
      )
    } catch (e) {
      setImportState('error')
      setImportMsg((e as Error).message)
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

      <div className="card">
        <div className="card-title">Restore data</div>
        <p className="small muted" style={{ margin: '0 0 8px' }}>
          Pulihkan dari file backup JSON yang pernah diunduh. Data dengan ID yang sama akan ditimpa.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importFile(f)
            e.target.value = ''
          }}
        />
        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
          <button className="btn" disabled={!ready || importState === 'busy'} onClick={() => fileRef.current?.click()}>
            {importState === 'busy' ? 'Mengimpor…' : '⬆ Pilih file JSON'}
          </button>
          {importState === 'done' && <span className="badge ok">{importMsg}</span>}
          {importState === 'error' && (
            <span className="badge" style={{ color: 'var(--danger)' }}>{importMsg}</span>
          )}
        </div>
      </div>
    </div>
  )
}
