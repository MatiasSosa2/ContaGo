type DiagnosticError = {
  name?: unknown
  message?: unknown
  code?: unknown
  cause?: unknown
}

function isDiagnosticError(value: unknown): value is DiagnosticError {
  return typeof value === 'object' && value !== null
}

function safeMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  return value
    .replace(/(?:https?|libsql|file):\/\/[^\s'"]+/gi, '[redacted-url]')
    .replace(/\b(token|secret|password|authorization|authToken)\b\s*[:=]\s*[^,\s'"]+/gi, '$1=[redacted]')
    .slice(0, 300)
}

function safeCode(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Z0-9_-]{1,64}$/i.test(value)
    ? value
    : undefined
}

export function getSafeErrorDiagnostics(error: unknown) {
  const chain: { name?: string; code?: string; message?: string }[] = []
  const visited = new Set<unknown>()
  let current: unknown = error

  while (isDiagnosticError(current) && chain.length < 4 && !visited.has(current)) {
    visited.add(current)
    const item: { name?: string; code?: string; message?: string } = {}
    if (typeof current.name === 'string') item.name = current.name.slice(0, 80)
    const code = safeCode(current.code)
    if (code) item.code = code
    const message = safeMessage(current.message)
    if (message) item.message = message
    chain.push(item)
    current = current.cause
  }

  if (chain.length === 0) {
    chain.push({ name: typeof error })
  }

  return chain
}
