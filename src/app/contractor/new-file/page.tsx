'use client'
// src/app/contractor/new-file/page.tsx
// Multi-step intake wizard for submitting a new SHE file

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatZAR, PRICING } from '@/lib/pricing'
import { PROJECT_TYPE_OPTIONS, HIGH_RISK_OPTIONS, CLIENT_TYPE_OPTIONS } from '@/lib/templates'

type Step = 1 | 2 | 3 | 4 | 5

const STEPS = [
  { n: 1, label: 'Project details' },
  { n: 2, label: 'Site & contacts' },
  { n: 3, label: 'Work & risks' },
  { n: 4, label: 'Price' },
  { n: 5, label: 'Review & pay' },
]

export default function NewFilePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    project_name:         '',
    project_value:        '',
    project_start_date:   '',
    project_end_date:     '',
    project_address:      '',
    principal_contractor: '',
    client_name:          '',
    site_agent:           '',
    project_type:         '',
    worker_count:         '',
    client_type:          'private',
    cidb_number:          '',
    cidb_grade:           '',
    subcontractors:       '',
  })
  const [risks, setRisks] = useState<string[]>([])
  const toggleRisk = (v: string) => setRisks(r => r.includes(v) ? r.filter(x => x !== v) : [...r, v])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const price = PRICING.FILE_PRICE

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/files/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          project_value: form.project_value ? parseFloat(form.project_value) : undefined,
          worker_count: parseInt(form.worker_count, 10),
          high_risk_activities: risks,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); setLoading(false); return }

      // Build and submit PayFast form programmatically
      const { payment } = data
      const pf = document.createElement('form')
      pf.method = 'POST'
      pf.action = payment.payfast_url

      Object.entries(payment).forEach(([k, v]) => {
        if (k === 'payfast_url') return
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = k
        input.value = String(v)
        pf.appendChild(input)
      })

      document.body.appendChild(pf)
      pf.submit()
    } catch {
      setError('Network error — please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-50">
      <header className="bg-brand-900 px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-brand-500 rounded-md flex items-center justify-center font-bold text-xs text-brand-900">PF</div>
          <span className="font-serif font-semibold text-white text-base">ProtekFlow</span>
        </div>
        <Link href="/contractor" className="text-brand-400 text-sm hover:text-white">← Back to dashboard</Link>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Step progress */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                step > s.n ? 'bg-brand-500 text-white'
                : step === s.n ? 'bg-brand-900 text-white'
                : 'bg-brand-200 text-brand-500'
              }`}>{step > s.n ? '✓' : s.n}</div>
              <span className={`text-xs hidden sm:block ${step === s.n ? 'text-brand-900 font-medium' : 'text-brand-400'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${step > s.n ? 'bg-brand-500' : 'bg-brand-200'}`} />}
            </div>
          ))}
        </div>

        <div className="dash-card">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-serif text-xl font-semibold text-brand-900">Project details</h2>
              <div>
                <label className="form-label">Project name <span className="text-red-500">*</span></label>
                <input className="form-input" type="text" placeholder="e.g. Sakhisizwe Clinic Extension Phase 2" value={form.project_name} onChange={set('project_name')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Project value (ZAR)</label>
                  <input className="form-input" type="number" placeholder="e.g. 1500000" value={form.project_value} onChange={set('project_value')} />
                </div>
                <div>
                  <label className="form-label">Client / employer name</label>
                  <input className="form-input" type="text" placeholder="e.g. Sakhisizwe Municipality" value={form.client_name} onChange={set('client_name')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Start date</label>
                  <input className="form-input" type="date" value={form.project_start_date} onChange={set('project_start_date')} />
                </div>
                <div>
                  <label className="form-label">End date</label>
                  <input className="form-input" type="date" value={form.project_end_date} onChange={set('project_end_date')} />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={() => setStep(2)} disabled={!form.project_name}
                  className="btn-primary disabled:opacity-50">
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-serif text-xl font-semibold text-brand-900">Site &amp; contacts</h2>
              <div>
                <label className="form-label">Site address <span className="text-red-500">*</span></label>
                <input className="form-input" type="text" placeholder="e.g. Erf 123, Hospital Street, Cala, Eastern Cape" value={form.project_address} onChange={set('project_address')} />
              </div>
              <div>
                <label className="form-label">Principal contractor (if different from you)</label>
                <input className="form-input" type="text" placeholder="Company name" value={form.principal_contractor} onChange={set('principal_contractor')} />
              </div>
              <div>
                <label className="form-label">Site agent / construction manager</label>
                <input className="form-input" type="text" placeholder="Full name" value={form.site_agent} onChange={set('site_agent')} />
              </div>
              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>
                <button onClick={() => setStep(3)} disabled={!form.project_address} className="btn-primary disabled:opacity-50">Continue →</button>
              </div>
            </div>
          )}

          {/* STEP 3 - Work & risks */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-serif text-xl font-semibold text-brand-900">Work &amp; risks</h2>
              <p className="text-sm text-brand-500">This is what your SHE file is built from, so please be accurate. Your professional reviews everything.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Type of work <span className="text-red-500">*</span></label>
                  <select className="form-input" value={form.project_type} onChange={set('project_type')}>
                    <option value="">Select...</option>
                    {PROJECT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Workers on site (at peak) <span className="text-red-500">*</span></label>
                  <input className="form-input" type="number" min={1} placeholder="e.g. 12" value={form.worker_count} onChange={set('worker_count')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">CIDB registration number</label>
                  <input className="form-input" type="text" placeholder="e.g. 1234567" value={form.cidb_number} onChange={set('cidb_number')} />
                </div>
                <div>
                  <label className="form-label">CIDB grade</label>
                  <input className="form-input" type="text" placeholder="e.g. 3GB" value={form.cidb_grade} onChange={set('cidb_grade')} />
                </div>
              </div>
              <div>
                <label className="form-label">Type of client</label>
                <select className="form-input" value={form.client_type} onChange={set('client_type')}>
                  {CLIENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">High-risk activities on this project</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {HIGH_RISK_OPTIONS.map(o => (
                    <label key={o.value} className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${risks.includes(o.value) ? 'border-brand-600 bg-brand-50' : 'border-brand-200'}`}>
                      <input type="checkbox" checked={risks.includes(o.value)} onChange={() => toggleRisk(o.value)} />
                      <span className="text-brand-900">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Subcontractors (one per line, optional)</label>
                <textarea className="form-input" rows={3} placeholder={"e.g. ABC Electrical\nXYZ Plumbing"} value={form.subcontractors} onChange={set('subcontractors')} />
              </div>
              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
                <button onClick={() => setStep(4)} disabled={!form.project_type || !(parseInt(form.worker_count, 10) >= 1)} className="btn-primary disabled:opacity-50">Continue →</button>
              </div>
            </div>
          )}

          
{/* STEP 4 - Price */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="font-serif text-xl font-semibold text-brand-900">Your fixed price</h2>
              <div className="rounded-xl border-2 border-brand-600 bg-brand-50 p-5 flex items-center justify-between">
                <div>
                  <div className="font-medium text-brand-900 text-sm">SHE file, reviewed and signed</div>
                  <div className="text-xs text-brand-500">One file per project &middot; 48-hour delivery target</div>
                </div>
                <div className="font-serif font-bold text-brand-900 text-2xl">{formatZAR(price)}</div>
              </div>
              <div className="bg-brand-50 rounded-xl p-4 text-sm text-brand-600">
                Your file is drafted from your project details, then reviewed and signed by a SACPCMP-registered professional.
              </div>
              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(3)} className="btn-secondary">← Back</button>
                <button onClick={() => setStep(5)} className="btn-primary">Review & pay →</button>
              </div>
            </div>
          )}

          {/* STEP 5 - Review */}
          {step === 5 && (
            <div className="space-y-5">
              <h2 className="font-serif text-xl font-semibold text-brand-900">Review &amp; pay</h2>
              <div className="bg-brand-50 rounded-xl p-5 space-y-2 text-sm">
                {[
                  ['Project',       form.project_name],
                  ['Site address',  form.project_address],
                  ['Client',        form.client_name || '—'],
                  ['Site agent',    form.site_agent || '—'],
                  ['Type of work',  PROJECT_TYPE_OPTIONS.find(o => o.value === form.project_type)?.label ?? '--'],
                  ['Workers on site', form.worker_count || '--'],
                  ['High-risk activities', risks.length ? risks.map(r => HIGH_RISK_OPTIONS.find(o => o.value === r)?.label).join(', ') : 'None'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-brand-500">{k}</span>
                    <span className="text-brand-900 font-medium text-right max-w-[60%]">{v}</span>
                  </div>
                ))}
                <div className="border-t border-brand-200 pt-3 mt-3 flex justify-between font-semibold text-base">
                  <span className="text-brand-700">Total due</span>
                  <span className="font-serif text-brand-900 text-xl">{formatZAR(price)}</span>
                </div>
              </div>

              <div className="bg-brand-900 text-white rounded-xl p-4 text-sm space-y-1.5">
                <div className="font-semibold text-brand-300 text-xs uppercase tracking-wide mb-2">What's included</div>
                {['SHE file drafted from your project details','Reviewed and signed by a SACPCMP-registered professional','48-hour delivery target','Built around the OHS Act 85/1993 and the Construction Regulations 2014'].map(i => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-brand-400 text-xs">✓</span>
                    <span className="text-brand-200">{i}</span>
                  </div>
                ))}
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

              <p className="text-xs text-brand-400 text-center">You will be redirected to PayFast to complete payment. Your SHE file will be queued immediately after payment is confirmed.</p>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(4)} className="btn-secondary">← Back</button>
                <button onClick={handleSubmit} disabled={loading}
                  className="btn-primary disabled:opacity-60">
                  {loading ? 'Redirecting to PayFast…' : `Pay ${formatZAR(price)} →`}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
