import { useEffect, useState } from 'react'
import { useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { DAY_NAMES } from '../types'
import { createPlan, updatePlan, deletePlan } from '../lib/gymstore'

interface Item {
  exerciseId: string
  targetSets: number
  reps: number
}

export default function PlanEditor({ onClose }: { onClose: () => void }) {
  const uid = useUid()
  const { plans, exercises } = useData()

  const [selDay, setSelDay] = useState<number>(new Date().getDay())
  const plan = plans.find((p) => p.dayOfWeek === selDay)

  const [name, setName] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (plan) {
      setName(plan.name)
      setItems(plan.items.slice().sort((a, b) => a.order - b.order))
    } else {
      setName('')
      setItems([])
    }
  }, [plan])

  function addItem(exerciseId: string) {
    setItems((cur) => [...cur, { exerciseId, reps: 10, targetSets: 3 }])
  }

  function removeItem(i: number) {
    setItems((cur) => cur.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  async function save() {
    setError('')
    if (!name.trim()) {
      setError('Nama jadwal wajib diisi.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        dayOfWeek: selDay,
        items: items.map((it, i) => ({
          exerciseId: it.exerciseId,
          order: i,
          targetSets: it.targetSets,
          reps: it.reps,
          restSec: 60,
        })),
      }
      if (plan) await updatePlan(uid, plan.id, payload)
      else await createPlan(uid, payload)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!plan) return
    if (!confirm(`Hapus jadwal "${plan.name}"?`)) return
    await deletePlan(uid, plan.id)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Kelola Jadwal Mingguan</h3>

        <div className="day-strip" style={{ marginBottom: 12 }}>
          {Array.from({ length: 7 }, (_, d) => (
            <button
              key={d}
              className={'day-chip' + (d === selDay ? ' active' : '')}
              onClick={() => setSelDay(d)}
              style={{ border: 'none', color: d === selDay ? '#1a1230' : 'inherit' }}
            >
              <div className="dow">{DAY_NAMES[d].slice(0, 3)}</div>
            </button>
          ))}
        </div>

        <div className="small muted" style={{ marginBottom: 12 }}>
          {plan ? `${DAY_NAMES[selDay]} — jadwal: ${plan.name}` : `${DAY_NAMES[selDay]} — belum ada jadwal`}
        </div>

        <div className="field">
          <label>Nama jadwal (mis. Push Day)</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Push Day" />
        </div>

        {items.length === 0 && <div className="empty small">Belum ada gerakan. Tambahkan di bawah.</div>}

        {items.map((it, i) => {
          return (
            <div className="row" key={i} style={{ padding: '6px 0' }}>
              <span className="num">{i + 1}.</span>
              <select
                className="grow"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', color: 'var(--text)' }}
                value={it.exerciseId}
                onChange={(e) => updateItem(i, { exerciseId: e.target.value })}
              >
                <option value="">Pilih gerakan…</option>
                {exercises.map((e2) => (
                  <option key={e2.id} value={e2.id}>{e2.name}</option>
                ))}
              </select>
              <input
                className="wt"
                type="number"
                style={{ width: 48 }}
                value={it.targetSets}
                min={1}
                onChange={(e) => updateItem(i, { targetSets: Number(e.target.value) })}
                title="Set"
              />
              <input
                className="wt"
                type="number"
                style={{ width: 48 }}
                value={it.reps}
                min={1}
                onChange={(e) => updateItem(i, { reps: Number(e.target.value) })}
                title="Rep"
              />
              <button className="icon-btn danger" onClick={() => removeItem(i)}>✕</button>
            </div>
          )
        })}

        {exercises.length > 0 && (
          <button className="btn sm ghost wide" onClick={() => addItem(exercises[0].id)}>
            + Tambah gerakan
          </button>
        )}

        {error && <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>}

        <div className="form-actions">
          <button className="btn" disabled={saving} onClick={() => void save()}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
          {plan && <button className="btn danger" onClick={() => void remove()}>Hapus</button>}
          <button className="btn ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}