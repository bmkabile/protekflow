'use client'
// src/app/consultant/files/[id]/page.tsx
// Consultant reviews the SHE file and triggers DocuSeal signing

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function ConsultantFileReview() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [file, setFile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/files/${id}`)
      .then(r => r.json())
      .then(d => { setFile(d.file); setLoading(false) })
      .catch(() => { setError('Failed to load file'); setLoading(false) })
  }, [id])

  const handleSign = async () => {
    setSigning(true)
    setError('')
    try {
      const res = await fetch(`/api/files/${id}/sign`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to initiate signing'); setSigning(false); return }
      // Redirect consultant to DocuSeal signing page
      window.location.href = data.signing_url
    } catch {
      setError('Network error — please try again.')
      setSigning(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center">
      <div className="text-brand-500">Loading file…</div>
    </div>
  )

  if (!file) return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center">
      <div className="text-red-500">{error || 'File not found'}</div>
    </div>
  )

  const sections = [
    { key: 'project_overview',      label: 'Project overview' },
    { key: 'hazard_identification',  label: 'Hazard identification (CR2014 Reg 9)' },
    { key: 'emergency_plan',         label: 'Emergency preparedness plan' },
    { key: 'incident_reporting',     label: 'Incident reporting procedure' },
    { key: 'ppe_register',           label: 'PPE register & issuance' },
    { key: 'first_aid',              label: 'First aid arrangements' },
    { key: 'induction_records',      label: 'Site induction records' },
    { key: 'subcontractor_info',     label: 'Subcontractor OHS info' },
  ]

  return (
    <div className="min-h-screen bg-brand-50">
      <header className="bg-brand-900 px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-brand-500 rounded-md flex items-center justify-center font-bold text-xs text-brand-900">PF</div>
          <span className="font-serif font-semibold text-white text-base">ProtekFlow</span>
          <span className="text-brand-500 text-sm ml-3">/ Review &amp; Sign</span>
        </div>
        <Link href="/consultant" className="text-brand-400 text-sm hover:text-white">← Dashboard</Link>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* File header */}
        <div className="dash-card mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-mono text-xs text-brand-400 mb-1">{file.file_number}</div>
              <h1 className="font-serif text-xl font-semibold text-brand-900">{file.project_name}</h1>
              <p className="text-brand-500 text-sm mt-1">{file.project_address}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-brand-400 mb-1">48h SLA deadline</div>
              <div className="font-semibold text-brand-800 text-sm">
                {file.sla_deadline
                  ? new Date(file.sla_deadline).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
                  : '—'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm border-t border-brand-100 pt-4">
            {[
              ['Contractor',   file.contractor_name ?? '—'],
              ['Project value',file.project_value ? `R${Number(file.project_value).toLocaleString()}` : '—'],
              ['Client',       file.client_name ?? '—'],
            ].map(([k,v]) => (
              <div key={k}>
                <div className="text-xs text-brand-400 mb-0.5">{k}</div>
                <div className="font-medium text-brand-800">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SHE file sections checklist */}
        <div className="dash-card mb-5">
          <h2 className="font-semibold text-brand-900 mb-4">SHE file sections — review each before signing</h2>
          <div className="space-y-2">
            {sections.map((s, i) => (
              <div key={s.key}
                className="flex items-center justify-between p-3 rounded-lg bg-brand-50 border border-brand-100">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand-200 text-brand-600 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <span className="text-sm text-brand-800 font-medium">{s.label}</span>
                </div>
                <span className="text-xs text-brand-500">Auto-generated ✓</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-brand-400 mt-4">
            These sections were generated by ProtekFlow AI based on the contractor's project details. As the SACPCMP-registered professional, you are responsible for reviewing, customising, and certifying the content before signing.
          </p>
        </div>

        {/* Legal attestation */}
        <div className="bg-brand-900 text-white rounded-xl p-6 mb-5">
          <h3 className="font-semibold mb-3 text-brand-200">Professional attestation</h3>
          <p className="text-brand-300 text-sm leading-relaxed mb-4">
            By clicking "Sign via DocuSeal" below, you confirm that you are a SACPCMP-registered Health and Safety professional, that you have reviewed and are satisfied with the contents of this SHE file, that the file complies with the requirements of the OHS Act 85/1993 and Construction Regulations 2014, and that you accept professional responsibility for the signed document.
          </p>
          <div className="flex items-start gap-3">
            <input type="checkbox" id="attest" className="mt-1 accent-brand-500" />
            <label htmlFor="attest" className="text-brand-300 text-sm cursor-pointer">
              I confirm the above attestation and accept professional responsibility for this SHE file.
            </label>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

        <div className="flex items-center justify-between">
          <Link href="/consultant" className="btn-secondary">← Back to dashboard</Link>
          <button onClick={handleSign} disabled={signing}
            className="bg-brand-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60">
            {signing ? 'Opening DocuSeal…' : 'Sign via DocuSeal →'}
          </button>
        </div>
      </div>
    </div>
  )
}
