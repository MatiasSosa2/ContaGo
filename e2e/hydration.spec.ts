import { test, expect } from '@playwright/test'

/**
 * Test de hidratación: detecta el warning de "hydration mismatch" de React
 * que motivó los fixes en StockClient y PeriodSelector. Si vuelve a aparecer,
 * este test falla y te avisa antes de que llegue a producción.
 *
 * Nota: al no haber sesión, estas rutas redirigen a login; igual capturamos
 * cualquier warning de hidratación emitido durante el render inicial.
 */

const HYDRATION_PATTERNS = [
  /hydrat/i,
  /did not match/i,
  /server rendered HTML didn't match/i,
  /Text content does not match/i,
]

const ROUTES = ['/', '/auth/login', '/auth/register']

for (const route of ROUTES) {
  test(`sin warnings de hidratación en ${route}`, async ({ page }) => {
    const hydrationWarnings: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      if (HYDRATION_PATTERNS.some((re) => re.test(text))) {
        hydrationWarnings.push(text)
      }
    })

    await page.goto(route)
    await page.waitForLoadState('networkidle')

    expect(
      hydrationWarnings,
      `Warnings de hidratación en ${route}:\n${hydrationWarnings.join('\n')}`,
    ).toHaveLength(0)
  })
}
