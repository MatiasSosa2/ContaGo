'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { approveAgentProposal, rejectAgentProposal } from '@/app/actions'
import type { AgentProposalView } from '@/server/agent/proposals'

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const SOURCE_LABEL: Record<string, string> = {
  TEXT: 'Texto',
  PHOTO: 'Comprobante',
  AUDIO: 'Audio',
}

function confidenceLabel(confidence: number): { text: string; cls: string } {
  if (confidence >= 0.85) return { text: 'Alta confianza', cls: 'bg-[var(--income-soft)] text-[var(--income)]' }
  if (confidence >= 0.5) return { text: 'Confianza media', cls: 'bg-[var(--warning)]/15 text-[var(--warning)] dark:bg-[var(--warning)]/20 dark:text-[var(--warning)]' }
  return { text: 'Revisar con cuidado', cls: 'bg-[#FEF3F2] text-[var(--expense)] dark:bg-[#3A1717] dark:text-[#FCA5A5]' }
}

function ProposalCard({
  proposal,
  onDecide,
  isPending,
}: {
  proposal: AgentProposalView
  onDecide?: (id: string, decision: 'APPROVED' | 'REJECTED') => void
  isPending: boolean
}) {
  const conf = confidenceLabel(proposal.confidence)
  return (
    <div className="ds-panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${conf.cls}`}>{conf.text}</span>
            <span className="text-[11px] text-[var(--ds-gray-400)]">{SOURCE_LABEL[proposal.source]} · {fmtDate(proposal.createdAt)}</span>
          </div>
          <p className="mt-2 text-[15px] font-semibold text-[var(--ds-gray-900)] dark:text-white">{proposal.summary}</p>
          <p className="mt-0.5 text-[13px] text-[var(--ds-gray-500)]">{proposal.draft.description}</p>
          {proposal.sourceText && (
            <p className="mt-2 rounded-xl bg-black/[0.035] px-3 py-2 text-[12px] italic text-[var(--ds-gray-600)] dark:bg-white/[0.06] dark:text-[var(--ds-gray-300)]">
              “{proposal.sourceText}”
            </p>
          )}
        </div>
      </div>
      {onDecide && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onDecide(proposal.id, 'APPROVED')}
            className="min-h-11 flex-1 rounded-xl bg-[#1E4B1C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#102D12] disabled:opacity-60 dark:bg-[#151515] dark:text-[#A8C89C] dark:ring-1 dark:ring-[#A8C89C]/30 dark:hover:bg-black"
          >
            Aprobar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onDecide(proposal.id, 'REJECTED')}
            className="min-h-11 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-[var(--expense)] hover:text-[var(--expense)] disabled:opacity-60 dark:border-white/10 dark:bg-transparent dark:text-gray-200"
          >
            Rechazar
          </button>
        </div>
      )}
    </div>
  )
}

export default function AgentTrayClient({
  pending,
  reviewed,
}: {
  pending: AgentProposalView[]
  reviewed: AgentProposalView[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDecide(id: string, decision: 'APPROVED' | 'REJECTED') {
    startTransition(async () => {
      setError(null)
      const result = decision === 'APPROVED'
        ? await approveAgentProposal(id)
        : await rejectAgentProposal(id)
      if (!result.success) {
        setError(result.error ?? 'No se pudo registrar la decisión')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl border border-[#FEE4E2] bg-[#FEF3F2] px-4 py-3 text-sm text-[var(--expense)] dark:border-[#2E1919] dark:bg-[#1F1514] dark:text-[#FCA5A5]">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-2 px-1 text-[13px] font-medium text-[var(--ds-gray-500)]">Para revisar</h2>
        {pending.length === 0 ? (
          <div className="ds-panel flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8EFE5] text-[#1E4B1C] dark:bg-[#151515] dark:text-[#A8C89C]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
            </span>
            <p className="mt-3 text-[15px] font-semibold text-[var(--ds-gray-900)] dark:text-white">Nada para revisar</p>
            <p className="mt-1 max-w-md text-[13px] leading-5 text-[var(--ds-gray-500)]">
              Cuando le mandes un comprobante o le cuentes un movimiento al agente, lo que entienda
              va a aparecer acá para que lo apruebes con un toque. Nada impacta en tu caja sin tu OK.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pending.map((p) => <ProposalCard key={p.id} proposal={p} onDecide={handleDecide} isPending={isPending} />)}
          </div>
        )}
      </section>

      {reviewed.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-[13px] font-medium text-[var(--ds-gray-500)]">Resueltas recientemente</h2>
          <div className="space-y-2 opacity-70">
            {reviewed.map((p) => (
              <div key={p.id} className="ds-panel flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[var(--ds-gray-900)] dark:text-white">{p.summary}</p>
                  <p className="text-[12px] text-[var(--ds-gray-400)]">{fmtDate(p.createdAt)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  p.status === 'APPROVED'
                    ? 'bg-[var(--income-soft)] text-[var(--income)]'
                    : 'bg-black/[0.06] text-[var(--ds-gray-500)] dark:bg-white/10'
                }`}>
                  {p.status === 'APPROVED' ? 'Aprobada' : 'Rechazada'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
