import { test, expect } from '@playwright/test'

/**
 * Smoke tests: verifican que la app arranca y las rutas críticas responden.
 * No dependen de datos ni de credenciales, así que corren siempre.
 */

test.describe('Smoke / salud del sistema', () => {
  test('el health check responde 200 y reporta la DB', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('status', 'ok')
    expect(body.checks.database.ok).toBe(true)
    // La latencia de DB no debería ser absurda.
    expect(body.checks.database.latencyMs).toBeLessThan(5000)
  })

  test('rutas protegidas redirigen a login cuando no hay sesión', async ({ page }) => {
    await page.goto('/stock')
    // Debe terminar en /auth/login (o mostrarlo) al no haber sesión.
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('la página de login renderiza y es accesible', async ({ page }) => {
    await page.goto('/auth/login')
    // Debe existir un campo de email y uno de contraseña.
    const email = page.locator('input[type="email"], input[name="email"]')
    const password = page.locator('input[type="password"], input[name="password"]')
    await expect(email.first()).toBeVisible()
    await expect(password.first()).toBeVisible()
  })

  test('no hay errores de consola críticos en el login', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    // Filtramos ruido conocido (favicon, fuentes, extensiones).
    const critical = errors.filter(
      (e) => !/favicon|font|extension|ResizeObserver/i.test(e),
    )
    expect(critical, `Errores de consola:\n${critical.join('\n')}`).toHaveLength(0)
  })
})
