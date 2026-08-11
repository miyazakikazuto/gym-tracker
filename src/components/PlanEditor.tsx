import { useEffect, useState } from 'react'
import { useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { DAY_NAMES } from '../types'
import { createPlan, updatePlan, deletePlan } from '../lib/gymstore'
import { PLAN_PRESETS, presetByName, presetByKey } from '../lib/templates'
import { exerciseIsDuration } from '../lib/helpers'

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

  const [presetKey, setPresetKey] = useState<string>('')
  const [items, setItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (plan) {
      setPresetKey(presetByName(plan.name)?.key ?? '')
      setItems(plan.items.slice().sort((a, b) => a.order - b.order))
    } else {
      setPresetKey('')
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

  function selectPreset(key: string) {
    setPresetKey(key)
    if (key === 'rest') setItems([])
  }

  async function save() {
    setError('')
    const preset = presetByKey(presetKey)
    if (!preset) {
      setError('Pilih jenis jadwal dulu.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: preset.name,
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

  async function resetAll() {
    if (plans.length === 0) return
    if (!confirm(`Hapus SEMUA jadwal mingguan (${plans.length} hari)? Sesi latihan tidak terpengaruh.`)) return
    setError('')
    try {
      await Promise.all(plans.map((p) => deletePlan(uid, p.id)))
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
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
          {plan ? `${DAY_NAMES[selDay]} — jadwal: ${plan.name}` : `${DAY_NAMES[selDay]} — belum ada jadwal (hari istirahat)`}
        </div>

        <div className="field">
          <label>Jenis jadwal</label>
          <div className="row wrap" style={{ gap: 8 }}>
            {PLAN_PRESETS.map((p) => (
              <button
                key={p.key}
                className={'btn sm' + (presetKey === p.key ? ' primary' : ' ghost')}
                onClick={() => selectPreset(p.key)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 && (
          <div className="empty small">
            {presetKey === 'rest'
              ? 'Hari istirahat — tanpa gerakan. Simpan untuk menandai hari ini.'
              : 'Pilih jenis jadwal, lalu tambah gerakan manual di bawah.'}
          </div>
        )}

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
                title={exerciseIsDuration(exercises, it.exerciseId) ? 'Durasi (dtk)' : 'Rep'}
              />
              <button className="icon-btn danger" onClick={() => removeItem(i)}>✕</button>
            </div>
          )
        })}

        {exercises.length > 0 && presetKey !== 'rest' && (
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
          {plans.length > 0 && <button className="btn danger" onClick={() => void resetAll()}>Reset minggu</button>}
          <button className="btn ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}
