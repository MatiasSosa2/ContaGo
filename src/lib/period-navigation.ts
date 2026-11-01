const PERIOD_QUERY_KEYS = ['periodo', 'day', 'weekStart', 'year', 'month', 'from', 'to'] as const

export function preservePeriodHref(href: string, currentSearch: string) {
  const [path, existing = ''] = href.split('?')
  const params = new URLSearchParams(existing)
  const current = new URLSearchParams(currentSearch)
  for (const key of PERIOD_QUERY_KEYS) {
    if (current.has(key)) params.set(key, current.get(key)!)
  }
  const query = params.toString()
  return `${path}${query ? `?${query}` : ''}`
}

export function periodQueryFrom(search: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const key of PERIOD_QUERY_KEYS) {
    const value = search[key]
    if (value) params.set(key, value)
  }
  return params.toString()
}
