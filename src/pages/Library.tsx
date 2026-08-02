import { useState } from 'react'
import { useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { createExercise, updateExercise, deleteExercise } from '../lib/gymstore'
import { MUSCLE_GROUPS, EQUIPMENTS, type Exercise } from '../types'

export default function Library() {
  const uid = useUid()
  const { exercises } = useData()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)

  return (
    <div className="page">
      <div className="row spread">
        <div>
          <div className="page-title">Gerakan</div>
          <div className="subtitle">Library latihan ({exercises.length})</div>
        </div>
        <button className="btn sm primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Baru</button>
      </div>

      {exercises.length === 0 && (
        <div className="card empty">Belum ada gerakan. Tambahkan yang pertama.</div>
      )}

      {exercises.map((ex) => (
        <div className="ex-item" key={ex.id}>
          <div>
            <div style={{ fontWeight: 700 }}>{ex.name}</div>
            <div className="meta">{ex.muscleGroup}</div>
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
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function ExerciseForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Exercise | null
  onClose: () => void
  onSaved: () => void
}) {
  const uid = useUid()
  const [name, setName] = useState(initial?.name ?? '')
  const [muscleGroup, setMuscleGroup] = useState<string>(initial?.muscleGroup ?? MUSCLE_GROUPS[0])
  const [equipment, setEquipment] = useState<string>(initial?.equipment ?? EQUIPMENTS[0])
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
      const data: Omit<Exercise, 'id'> = { name: name.trim(), muscleGroup, equipment }
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
          <label>Grup otot</label>
          <select className="input" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)}>
            {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Alat</label>
          <select className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
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