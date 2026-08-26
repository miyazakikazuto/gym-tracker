import { useState } from 'react'
import { useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { createExercise, updateExercise, deleteExercise, updateSession } from '../lib/gymstore'
import { MUSCLE_GROUPS, EQUIPMENTS, EXERCISE_CATEGORIES, EXERCISE_TYPES, type Exercise, type Session, type WorkoutPlan } from '../types'
import { categoryOfExercise, categoryKeysOfExercise } from '../lib/helpers'
import Modal from '../components/Modal'

export default function Library() {
  const uid = useUid()
  const { exercises, sessions, plans, showToast } = useData()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [tab, setTab] = useState<string>('push')
  const [query, setQuery] = useState('')
  const [confirmDel, setConfirmDel] = useState<Exercise | null>(null)
  const [showDuplicates, setShowDuplicates] = useState(false)

  // --- Duplicate detection ---
  function normalizeForDup(name: string): string {
    return name.toLowerCase().trim()
      .replace(/^(barbell|dumbbell|cable|machine|bw|bodyweight)\s+/i, '')
      .replace(/\s*\((barbell|dumbbell|cable|machine)\)$/i, '')
      .replace(/\bpress\b/g, 'press')
      .replace(/\bcurls?\b/g, 'curl')
      .replace(/\brows?\b/g, 'row')
      .replace(/\bs\b/g, '')
  }

  function findDuplicates(): Exercise[][] {
    const groups = new Map<string, Exercise[]>()
    for (const ex of exercises) {
      const key = normalizeForDup(ex.name)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(ex)
    }
    return [...groups.values()]
      .filter((g) => g.length > 1)
      .sort((a, b) => b.length - a.length)
  }

  async function mergeDuplicates(
    keepId: string,
    deleteIds: string[],
    allSessions: Session[],
    allPlans: WorkoutPlan[],
  ) {
    for (const exId of deleteIds) {
      for (const sess of allSessions) {
        const updatedSets = sess.sets.map((s) =>
          s.exerciseId === exId ? { ...s, exerciseId: keepId } : s,
        )
        if (updatedSets.some((s, i) => s !== sess.sets[i])) {
          await updateSession(uid, sess.id, { sets: updatedSets })
        }
      }
      for (const plan of allPlans) {
        const updatedItems = plan.items.map((it) =>
          it.exerciseId === exId ? { ...it, exerciseId: keepId } : it,
        )
        if (updatedItems.some((it, i) => it !== plan.items[i])) {
          const { updatePlan } = await import('../lib/gymstore')
          await updatePlan(uid, plan.id, { name: plan.name, dayOfWeek: plan.dayOfWeek, items: updatedItems })
        }
      }
    }
    for (const id of deleteIds) {
      await deleteExercise(uid, id)
    }
  }

  const dupGroups = findDuplicates()

  const list = exercises.filter(
    (e) =>
      categoryKeysOfExercise(e).includes(tab) &&
      (query.trim() === '' || e.name.toLowerCase().includes(query.trim().toLowerCase())),
  )

  return (
    <div className="page">
      <div className="row spread">
        <div>
          <div className="page-title">Gerakan</div>
          <div className="subtitle">Library latihan ({exercises.length})</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {dupGroups.length > 0 && (
            <button className="btn sm ghost" onClick={() => setShowDuplicates(true)}>
              🔍 {dupGroups.length} Duplikat
            </button>
          )}
          <button className="btn sm primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Baru</button>
        </div>
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

      <input
        className="input"
        type="search"
        placeholder="Cari gerakan…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 10 }}
      />

      {list.length === 0 && (
        <div className="card empty">
          {query.trim()
            ? 'Tidak ada gerakan yang cocok dengan pencarian.'
            : 'Belum ada gerakan di kategori ini. Ketuk + Baru.'}
        </div>
      )}

      {list.map((ex) => (
        <div className="ex-item" key={ex.id}>
          <div>
            <div style={{ fontWeight: 700 }}>{ex.name}</div>
            <div className="meta">
              {ex.muscleGroup} · {ex.type === 'duration' ? 'durasi' : 'reps'}
              {ex.extraCategories && ex.extraCategories.length > 0 && (
                <span> · juga: {ex.extraCategories.map((c) => EXERCISE_CATEGORIES.find((x) => x.key === (c === 'home' ? 'easy' : c))?.name ?? c).join(', ')}</span>
              )}
            </div>
          </div>
          <div className="row">
            <span className="badge">{ex.equipment}</span>
            <button className="icon-btn" aria-label={`Edit ${ex.name}`} onClick={() => { setEditing(ex); setShowForm(true) }}>✎</button>
            <button className="icon-btn danger" aria-label={`Hapus ${ex.name}`} onClick={() => setConfirmDel(ex)}>🗑</button>
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

      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)} label="Hapus gerakan">
          <h3>Hapus gerakan?</h3>
          <div className="small muted" style={{ marginBottom: 10 }}>
            "{confirmDel.name}" akan dihapus dari library. Sesi lama yang memakainya tetap tersimpan.
          </div>
          <div className="form-actions">
            <button className="btn ghost" onClick={() => setConfirmDel(null)}>Batal</button>
            <button
              className="btn danger"
              onClick={() => {
                const id = confirmDel.id
                setConfirmDel(null)
                void deleteExercise(uid, id).catch(() => showToast('Gagal menghapus gerakan — cek koneksi internet', 'error'))
              }}
            >
              Hapus
            </button>
          </div>
        </Modal>
      )}

      {showDuplicates && (
        <DuplicatesModal
          groups={dupGroups}
          onClose={() => setShowDuplicates(false)}
          onMerge={(keepId, deleteIds) => {
            void mergeDuplicates(keepId, deleteIds, sessions, plans)
              .then(() => { showToast('Duplikat digabungkan'); setShowDuplicates(false) })
              .catch(() => showToast('Gagal menggabungkan — cek koneksi', 'error'))
          }}
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
  const initCat = initial?.category
      ? categoryOfExercise({ category: initial.category, muscleGroup: initial.muscleGroup })
      : defaultCategory
  const [category, setCategory] = useState<string>(initCat)
  const [extra, setExtra] = useState<string[]>(initial?.extraCategories ?? [])
  const [type, setType] = useState<'reps' | 'duration'>(initial?.type ?? (initCat === 'cardio' ? 'duration' : 'reps'))
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
      const data: Omit<Exercise, 'id'> = {
        name: name.trim(),
        muscleGroup,
        equipment,
        category,
        type,
        ...(extra.length > 0 ? { extraCategories: extra } : {}),
      }
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
    <Modal onClose={onClose} label={initial ? 'Edit gerakan' : 'Gerakan baru'}>
        <h3>{initial ? 'Edit gerakan' : 'Gerakan baru'}</h3>

        <div className="field">
          <label>Nama gerakan</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Barbell Bench Press" autoFocus />
        </div>

        <div className="field">
          <label>Kategori</label>
          <select className="input" value={category} onChange={(e) => {
            const c = e.target.value
            setCategory(c)
            if (c === 'cardio') setType('duration')
          }}>
            {EXERCISE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Juga tampil di hari lain</label>
          <div className="row wrap" style={{ gap: 6 }}>
            {EXERCISE_CATEGORIES.filter((c) => c.key !== category && c.key !== 'cardio').map((c) => {
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
          <label>Cara pencatatan</label>
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
    </Modal>
  )
}

function DuplicatesModal({
  groups,
  onClose,
  onMerge,
}: {
  groups: Exercise[][]
  onClose: () => void
  onMerge: (keepId: string, deleteIds: string[]) => void
}) {
  const [selected, setSelected] = useState<Record<string, string | null>>({})

  function pickKeep(groupId: string, keepId: string) {
    setSelected((s) => ({ ...s, [groupId]: keepId }))
  }

  function handleMergeGroup(group: Exercise[]) {
    const keepId = selected[group[0].id]
    if (!keepId) return
    const deleteIds = group.filter((e) => e.id !== keepId).map((e) => e.id)
    onMerge(keepId, deleteIds)
  }

  return (
    <Modal onClose={onClose} label="Duplikat ditemukan">
      <h3>Duplikat ditemukan</h3>
      <div className="small muted" style={{ marginBottom: 10 }}>
        {groups.length} grup duplikat. Pilih gerakan yang ingin disimpan, sisanya akan dihapus & digabungkan.
      </div>
      {groups.map((group) => (
        <div key={group[0].id} className="card" style={{ marginBottom: 8, padding: 10 }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>
            "{group[0].name}" — {group.length} salinan
          </div>
          {group.map((ex) => (
            <div key={ex.id} className="row" style={{ padding: '4px 0', gap: 8 }}>
              <button
                className={'rpe-chip' + ((selected[group[0].id] ?? group[0].id) === ex.id ? ' active' : '')}
                onClick={() => pickKeep(group[0].id, ex.id)}
              >
                Simpan
              </button>
              <span className="grow small">{ex.name}</span>
              <span className="badge">{ex.equipment}</span>
              <span className="badge">{ex.muscleGroup}</span>
            </div>
          ))}
          <button
            className="btn sm primary"
            style={{ marginTop: 6 }}
            disabled={!selected[group[0].id]}
            onClick={() => handleMergeGroup(group)}
          >
            Gabungkan ({group.filter((e) => e.id !== (selected[group[0].id] ?? group[0].id)).length} hapus)
          </button>
        </div>
      ))}
      <div className="form-actions">
        <button className="btn ghost" onClick={onClose}>Tutup</button>
      </div>
    </Modal>
  )
}
