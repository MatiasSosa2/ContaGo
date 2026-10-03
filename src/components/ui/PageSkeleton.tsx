/**
 * Pantalla de carga estilo iOS: la forma de la página (encabezado, tarjetas, gráfico y
 * lista) en grises que laten suave, mientras llegan los datos.
 */
function Bone({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.08] ${className}`} />
}

function CardShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#1C1C1E] dark:shadow-none ${className}`}>
      {children}
    </div>
  )
}

export default function PageSkeleton({ cards = 3, chart = false }: { cards?: number; chart?: boolean }) {
  const cols = cards >= 4 ? 'md:grid-cols-4' : cards === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
  return (
    <div className="mx-auto min-h-screen max-w-[1920px] bg-[#F2F2F7] p-4 dark:bg-black sm:p-6 lg:p-8" aria-busy="true" aria-label="Cargando">
      {/* Encabezado: título + selector de período */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Bone className="h-7 w-40" />
        <Bone className="h-9 w-72 rounded-full" />
      </div>

      {cards > 0 && (
        <div className={`mb-4 grid grid-cols-1 gap-4 ${cols}`}>
          {Array.from({ length: cards }, (_, i) => (
            <CardShell key={i}>
              <Bone className="h-3 w-24" />
              <Bone className="mt-4 h-7 w-36" />
              <Bone className="mt-4 h-10 w-full" />
            </CardShell>
          ))}
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${chart ? 'lg:grid-cols-5' : ''}`}>
        {/* Lista / tabla */}
        <CardShell className={chart ? 'lg:col-span-3' : ''}>
          <Bone className="h-4 w-32" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Bone className="h-3.5 w-1/2" />
                <Bone className="h-3.5 w-20 shrink-0" />
              </div>
            ))}
          </div>
        </CardShell>
        {chart && (
          <CardShell className="lg:col-span-2">
            <Bone className="h-4 w-28" />
            <Bone className="mt-5 h-48 w-full" />
          </CardShell>
        )}
      </div>
    </div>
  )
}
