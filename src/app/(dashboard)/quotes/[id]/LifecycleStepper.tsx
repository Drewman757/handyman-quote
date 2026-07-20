import { XCircle } from 'lucide-react'

interface Stage {
  label: string
  done: boolean
}

export function LifecycleStepper({ status, stages }: { status: string; stages: Stage[] }) {
  // Declined is a distinct end-state, not a point on the linear stepper —
  // showing it as "stuck" partway through would misrepresent what happened.
  if (status === 'declined') {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
        <span className="text-sm font-medium text-red-700">Quote declined</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-x-auto overscroll-x-contain touch-pan-x">
      <div className="flex items-start gap-1 min-w-max">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-start">
            <div className="flex flex-col items-center gap-1 w-16">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  s.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {s.done && '✓'}
              </div>
              <span className={`text-[10px] text-center leading-tight ${s.done ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className={`h-px w-4 mt-3 ${s.done ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
