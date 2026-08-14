import { useRef, useState } from 'react'
import { updatePassword } from 'firebase/auth'
import { useAuth, useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { todayKey, addDays } from '../lib/date'
import { getAuthInstance } from '../lib/firebase'
import { importBackup } from '../lib/gymstore'
import { rotationOf } from '../lib/rotation'
import { cycleShiftAt, DEFAULT_SHIFT_ANCHOR, SHIFT_LABELS, SHIFT_TYPES, SHIFT_COLORS, alignAnchor } from '../lib/shift'
import { presetByKey, dotColorFor } from '../lib/templates'
import Modal from '../components/Modal'
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

const DATA_TYPES = [
  { key: 'exercises', label: 'Gerakan' },
  { key: 'plans', label: 'Jadwal' },
  { key: 'sessions', label: 'Sesi' },
  { key: 'weights', label: 'Berat badan' },
] as const

type SelKey = (typeof DATA_TYPES)[number]['key']

export default function Settings() {
  const uid = useUid()
  const { user } = useAuth()
  const { exercises, plans, sessions, bodyweights, settings, ready, saveSettings } = useData()
  const rot = rotationOf(settings)
  const rotationMode = settings.rotationMode !== false // default: aktif
  const nextShifts = Array.from({ length: 12 }, (_, i) => {
    const date = addDays(rot.anchor, i)
    return { date, sh: cycleShiftAt(rot.anchor, date) }
  })
  const overrideCount = Object.keys(settings.shiftOverride ?? {}).length
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')
  const [showPw, setShowPw] = useState(false)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [importState, setImportState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [importMsg, setImportMsg] = useState('')
  const [sel, setSel] = useState<Record<SelKey, boolean>>({
    exercises: true,
    plans: true,
    sessions: true,
    weights: true,
  })
  const [finishedOnly, setFinishedOnly] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const finishedSessions = sessions.filter((s) => s.endedAt !== null).length

  function moveRotation(idx: number, dir: -1 | 1) {
    const arr = [...rot.rotation]
    const j = idx + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
    saveSettings({ rotation: arr })
  }

  async function savePassword() {
    setPwMsg('')
    if (pw1.length < 6) {
      setPwMsg('Sandi minimal 6 karakter.')
      return
    }
    if (pw1 !== pw2) {
      setPwMsg('Sandi tidak sama.')
      return
    }
    setPwBusy(true)
    try {
      const cur = getAuthInstance().currentUser
      if (!cur) throw new Error('Sesi berakhir. Login ulang dulu.')
      await updatePassword(cur, pw1)
      setShowPw(false)
      setPw1('')
      setPw2('')
      setPwMsg('Sandi tersimpan. Sekarang bisa login dengan email + sandi di semua perangkat.')
    } catch (e) {
      setPwMsg(msgOf(e))
    } finally {
      setPwBusy(false)
    }
  }

  function toggle(key: SelKey) {
    setSel((s) => ({ ...s, [key]: !s[key] }))
  }

  function exportData() {
    try {
      const outSessions = sel.sessions ? (finishedOnly ? sessions.filter((s) => s.endedAt !== null) : sessions) : []
      const payload = {
        app: 'gym-tracker',
        type: 'backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        counts: {
          exercises: sel.exercises ? exercises.length : 0,
          plans: sel.plans ? plans.length : 0,
          sessions: outSessions.length,
          bodyweights: sel.weights ? bodyweights.length : 0,
        },
        exercises: sel.exercises ? exercises : [],
        plans: sel.plans ? plans : [],
        sessions: outSessions,
        bodyweights: sel.weights ? bodyweights : [],
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
      if (!data || typeof data !== 'object') {
        throw new Error('File bukan backup Gym Tracker yang valid')
      }
      const hasAny =
        Array.isArray(data.exercises) ||
        Array.isArray(data.plans) ||
        Array.isArray(data.sessions) ||
        Array.isArray(data.bodyweights)
      if (!hasAny) {
        throw new Error('File bukan backup Gym Tracker yang valid (tidak ada data yang dikenali)')
      }
      const exs = (Array.isArray(data.exercises) ? data.exercises : []).filter(
        (x) => x && typeof (x as { id?: unknown }).id === 'string',
      ) as Exercise[]
      const pls = (Array.isArray(data.plans) ? data.plans : []).filter(
        (x) => x && typeof (x as { id?: unknown }).id === 'string',
      ) as WorkoutPlan[]
      const ses = (Array.isArray(data.sessions) ? data.sessions : []).filter(
        (x) => x && typeof (x as { id?: unknown }).id === 'string',
      ) as Session[]
      const bws = (Array.isArray(data.bodyweights) ? data.bodyweights : []).filter(
        (x) => x && typeof (x as { date?: unknown }).date === 'string' && typeof (x as { kg?: unknown }).kg === 'number',
      ) as Bodyweight[]

      if (exs.length + pls.length + ses.length + bws.length === 0) {
        throw new Error('Tidak ada data valid di file ini')
      }

      if (!confirm('Import akan menimpa data yang ID-nya sama dengan backup. Lanjutkan?')) {
        setImportState('idle')
        return
      }

      const total = await importBackup(uid, { exercises: exs, plans: pls, sessions: ses, bodyweights: bws })
      setImportState('done')
      setImportMsg(
        `✓ ${exs.length} gerakan, ${pls.length} jadwal, ${ses.length} sesi, ${bws.length} berat diimpor (${total} tulis)`,
      )
    } catch (e) {
      setImportState('error')
      setImportMsg((e as Error).message)
    }
  }

  return (
    <div className="page">
      <div className="page-title">Pengaturan</div>
      <div className="subtitle">Jadwal, akun, backup & data</div>

      <div className="card">
        <div className="card-title">Mode jadwal</div>
        <div className="row" style={{ gap: 6 }}>
          <button
            className={'btn sm ' + (rotationMode ? 'primary' : 'ghost')}
            style={{ flex: 1 }}
            onClick={() => saveSettings({ rotationMode: true })}
          >
            Rotasi
          </button>
          <button
            className={'btn sm ' + (!rotationMode ? 'primary' : 'ghost')}
            style={{ flex: 1 }}
            onClick={() => saveSettings({ rotationMode: false })}
          >
            Mingguan
          </button>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          {rotationMode
            ? 'Saran harian mengikuti urutan rotasi & sesi terakhir — cocok untuk jadwal kerja shift.'
            : 'Jadwal tetap per hari (mis. Senin Push) — ditampilkan di halaman Hari Ini.'}
        </div>

        {rotationMode && (
          <>
            <div className="divider" />
            <div className="card-title" style={{ marginTop: 4 }}>Urutan rotasi</div>
            {rot.rotation.map((k, i) => {
              const name = presetByKey(k)?.name ?? k
              return (
                <div className="rotate-item" key={k}>
                  <span className="dot" style={{ background: dotColorFor(name) ?? 'var(--accent)' }} />
                  <span className="name">{name}</span>
                  <button className="mv" aria-label={`Naikkan ${name}`} disabled={i === 0} onClick={() => moveRotation(i, -1)}>↑</button>
                  <button className="mv" aria-label={`Turunkan ${name}`} disabled={i === rot.rotation.length - 1} onClick={() => moveRotation(i, 1)}>↓</button>
                </div>
              )
            })}
            <div className="small muted" style={{ marginTop: 4 }}>
              Saran = item setelah sesi terakhir yang selesai. Urutan bisa diubah bebas.
            </div>

            <div className="divider" />
            <div className="card-title" style={{ marginTop: 4 }}>Target frekuensi</div>
            <div className="row">
              <span className="grow small muted">Sesi per 7 hari (berjalan)</span>
              <span className="stepper">
                <button className="b" aria-label="Kurangi target" onClick={() => saveSettings({ weeklyTarget: Math.max(2, rot.weeklyTarget - 1) })}>−</button>
                <span className="val">{rot.weeklyTarget}</span>
                <button className="b" aria-label="Tambah target" onClick={() => saveSettings({ weeklyTarget: Math.min(7, rot.weeklyTarget + 1) })}>+</button>
              </span>
            </div>
            <div className="small muted" style={{ marginTop: 8 }}>
              Target sesi latihan sungguhan (Leg/Push/Pull) per 7 hari berjalan — Easy tidak dihitung.
            </div>

            <div className="divider" />
            <div className="card-title" style={{ marginTop: 4 }}>Shift kerja</div>
            <div className="small muted" style={{ marginBottom: 8 }}>
              Shift dihitung otomatis dari siklus <b>3 hari kerja → 1 hari libur</b>, bergilir Sore → Malam → Pagi (rotasi maju).
            </div>
            <div className="small" style={{ marginBottom: 6, fontWeight: 700 }}>Set patokan dari shift hari ini:</div>
            <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
              {SHIFT_TYPES.map((sh) => (
                <button
                  key={sh}
                  className="chipb"
                  onClick={() => saveSettings({ shiftAnchor: alignAnchor(rot.anchor, todayKey(), sh) })}
                >
                  <span className="chip-dot" style={{ background: SHIFT_COLORS[sh] }} />
                  {SHIFT_LABELS[sh]}
                </button>
              ))}
            </div>
            <div className="small muted" style={{ marginBottom: 10 }}>
              Patokan dihitung otomatis mundur dari pilihan Anda — saat ini <b>{rot.anchor}</b> (hari ke-1 Sore).
            </div>
            <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
              {nextShifts.map(({ date, sh }) => (
                <span
                  key={date}
                  className={'chipb' + (sh === 'libur' ? ' rest' : '')}
                  style={sh !== 'libur' ? { color: SHIFT_COLORS[sh] } : undefined}
                >
                  <span className="chip-dot" style={{ background: SHIFT_COLORS[sh] }} />
                  {date.slice(8, 10)}/{date.slice(5, 7)} {SHIFT_LABELS[sh]}
                </span>
              ))}
            </div>
            <div className="row wrap" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
              {overrideCount > 0 && (
                <>
                  <span className="small muted grow">{overrideCount} tanggal ditimpa manual</span>
                  <button className="btn sm ghost" onClick={() => saveSettings({ shiftOverride: {} })}>
                    Hapus penimpaan
                  </button>
                </>
              )}
              <button className="btn sm ghost" onClick={() => saveSettings({ shiftAnchor: DEFAULT_SHIFT_ANCHOR })}>
                Reset patokan ke 15 Ags 2026
              </button>
            </div>
            <div className="small muted">
              Saat shift <b>Malam</b>, saran otomatis ringan (Easy). Timpa shift hari ini di halaman Hari Ini.
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">Akun</div>
        <div className="row" style={{ padding: '4px 0 8px' }}>
          <div className="grow">
            <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{user?.email}</div>
            <div className="small muted">Login dengan email + sandi atau Google</div>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn sm primary" onClick={() => { setPwMsg(''); setShowPw(true) }}>Atur kata sandi</button>
          <button className="btn sm ghost" onClick={() => getAuthInstance().signOut()}>Keluar</button>
        </div>
        {pwMsg && !showPw && (
          <div className="small" style={{ color: 'var(--ok)', marginTop: 10 }}>{pwMsg}</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Backup data</div>
        <p className="small muted" style={{ margin: '0 0 8px' }}>
          Pilih data yang mau diunduh, lalu ekspor ke file JSON. Sesi menyertakan catatan, set, dan RPE-nya.
        </p>
        <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
          {DATA_TYPES.map((t) => (
            <button
              key={t.key}
              className={'rpe-chip' + (sel[t.key] ? ' active' : '')}
              onClick={() => toggle(t.key)}
            >
              {sel[t.key] ? '☑ ' : '☐ '}{t.label}
            </button>
          ))}
        </div>
        {sel.sessions && (
          <label className="row small" style={{ gap: 6, alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={finishedOnly} onChange={(e) => setFinishedOnly(e.target.checked)} />
            Hanya sesi yang selesai ({finishedSessions} dari {sessions.length})
          </label>
        )}
        <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
          {sel.exercises && <span className="badge">{exercises.length} gerakan</span>}
          {sel.plans && <span className="badge">{plans.length} jadwal</span>}
          {sel.sessions && (
            <span className="badge">
              {(finishedOnly ? finishedSessions : sessions.length)} sesi
              {finishedOnly ? ' (selesai)' : ''}
            </span>
          )}
          {sel.weights && <span className="badge">{bodyweights.length} catatan berat</span>}
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
          <button
            className="btn primary"
            disabled={!ready || !(sel.exercises || sel.plans || sel.sessions || sel.weights)}
            onClick={exportData}
          >
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
          Pulihkan dari file backup JSON (bisa backup parsial). Data dengan ID yang sama akan ditimpa.
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

      {showPw && (
        <Modal onClose={() => setShowPw(false)} label="Atur kata sandi">
          <h3>Atur kata sandi</h3>
          <div className="small muted" style={{ marginBottom: 10 }}>
            Pakai email <b>{user?.email}</b> + sandi ini untuk login di semua perangkat (termasuk iPhone) — tanpa perlu Google.
          </div>
          <input className="input" type="password" autoComplete="new-password" placeholder="Sandi baru (min. 6 karakter)"
            value={pw1} onChange={(e) => setPw1(e.target.value)} disabled={pwBusy} />
          <input className="input" type="password" autoComplete="new-password" placeholder="Ulangi sandi"
            value={pw2} onChange={(e) => setPw2(e.target.value)} disabled={pwBusy} />
          {pwMsg && <div className="auth-error" style={{ marginTop: 8 }}>{pwMsg}</div>}
          <div className="form-actions">
            <button className="btn ghost" onClick={() => setShowPw(false)} disabled={pwBusy}>Batal</button>
            <button className="btn primary" onClick={() => void savePassword()} disabled={pwBusy}>
              {pwBusy ? 'Menyimpan…' : 'Simpan sandi'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function msgOf(err: unknown): string {
  const m = (err as { message?: string }).message
  if (!m) return 'Terjadi kesalahan. Coba lagi.'
  return m.replace(/^Firebase: /, '').replace(/ \(.*\)\.$/, '')
}
