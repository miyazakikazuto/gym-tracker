import { useState } from 'react'
import { useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { createExercise, updateExercise, deleteExercise } from '../lib/gymstore'
import { MUSCLE_GROUPS, EQUIPMENTS, EXERCISE_CATEGORIES, EXERCISE_TYPES, type Exercise } from '../types'
import { categoryOfExercise, categoryKeysOfExercise } from '../lib/helpers'

export default function Library() {
  const uid = useUid()
  const { exercises } = useData()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [tab, setTab] = useState<string>('push')

  const list = exercises.filter((e) => categoryKeysOfExercise(e).includes(tab))

  return (
    <div className="page">
      <div className="row spread">
        <div>
          <div className="page-title">Gerakan</div>
          <div className="subtitle">Library latihan ({exercises.length})</div>
        </div>
        <button className="btn sm primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Baru</button>
      </div>

      <div className="day-strip" style={{ paddingBottom: 10 }}>
        {EXERCISE_CATEGORIES.map((c) => {
          const count = exercises.filter((e) => categoryKeysOfExercise(e).includes(c.key)).length
          return (
            <button
              key={c.key}
              className={'day-chip' + (tab === c.key ? ' active' : '')}
              onClick={() => setTab(c.key)}
              style={{ border: 'none', flex: '1 1 0', minWidth: 0, color: tab === c.key ? '#1a1230' : 'inherit' }}
            >
              <div className="dow">{c.shortLabel}</div>
              <div className="dnum" style={{ fontSize: 13 }}>{count}</div>
            </button>
          )
        })}
      </div>

      {list.length === 0 && (
        <div className="card empty">Belum ada gerakan di kategori ini. Ketuk + Baru.</div>
      )}

      {list.map((ex) => (
        <div className="ex-item" key={ex.id}>
          <div>
            <div style={{ fontWeight: 700 }}>{ex.name}</div>
            <div className="meta">
              {ex.muscleGroup} · {ex.type === 'duration' ? 'durasi' : 'reps'}
              {ex.extraCategories && ex.extraCategories.length > 0 && (
                <span> · juga: {ex.extraCategories.map((c) => EXERCISE_CATEGORIES.find((x) => x.key === c)?.name ?? c).join(', ')}</span>
              )}
            </div>
          </div>
          <div className="row">
            <span className="badge">{ex.equipment}</span>
            <button className="icon-btn" onClick={() => { setEditing(ex); setShowForm(true) }}>✎</button>
            <button className="icon-btn danger" onClick={() => { if (confirm(`Hapus "${ex.name}"?`)) void deleteExercise(uid, ex.id) }}>🗑</button>
          </div>
        </div>
      ))}

      {showForm && (
        <ExerciseForm
          initial={editing}
          defaultCategory={tab}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function ExerciseForm({
  initial,
  defaultCategory,
  onClose,
  onSaved,
}: {
  initial: Exercise | null
  defaultCategory: string
  onClose: () => void
  onSaved: () => void
}) {
  const uid = useUid()
  const [name, setName] = useState(initial?.name ?? '')
  const [muscleGroup, setMuscleGroup] = useState<string>(initial?.muscleGroup ?? MUSCLE_GROUPS[0])
  const [equipment, setEquipment] = useState<string>(initial?.equipment ?? EQUIPMENTS[0])
  const [category, setCategory] = useState<string>(
    initial?.category ?? categoryOfExercise({ muscleGroup: initial?.muscleGroup ?? MUSCLE_GROUPS[0] }) ?? defaultCategory,
  )
  const [extra, setExtra] = useState<string[]>(initial?.extraCategories ?? [])
  const [type, setType] = useState<'reps' | 'duration'>(initial?.type ?? 'reps')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!name.trim()) {
      setError('Nama gerakan wajib diisi.')
      return
    }
    setBusy(true)
    try {
      const data: Omit<Exercise, 'id'> = { name: name.trim(), muscleGroup, equipment, category, extraCategories: extra.length > 0 ? extra : undefined, type }
      if (initial) await updateExercise(uid, initial.id, data)
      else await createExercise(uid, data)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? 'Edit gerakan' : 'Gerakan baru'}</h3>

        <div className="field">
          <label>Nama gerakan</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Barbell Bench Press" autoFocus />
        </div>

        <div className="field">
          <label>Kategori</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXERCISE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Juga tampil di hari lain</label>
          <div className="row wrap" style={{ gap: 6 }}>
            {EXERCISE_CATEGORIES.filter((c) => c.key !== category).map((c) => {
              const on = extra.includes(c.key)
              return (
                <button
                  key={c.key}
                  type="button"
                  className={'rpe-chip' + (on ? ' active' : '')}
                  onClick={() => setExtra(on ? extra.filter((k) => k !== c.key) : [...extra, c.key])}
                >
                  {c.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="field">
          <label>Jenis set</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as 'reps' | 'duration')}>
            {EXERCISE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Grup otot</label>
          <select className="input" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)}>
            {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Alat</label>
          <select className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            {!(EQUIPMENTS as readonly string[]).includes(equipment) && <option value={equipment}>{equipment}</option>}
            {EQUIPMENTS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="form-actions">
          <button className="btn primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button className="btn ghost" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}
