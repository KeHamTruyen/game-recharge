import { test, expect, type Page } from "@playwright/test"
import type { useAppStore } from "../src/app/AppStore"

type Store = ReturnType<typeof useAppStore>
declare global {
  interface Window {
    currentStore: () => Store
    oldStore: Store
    pendingResult: Promise<unknown>
  }
}

const admin = { id: "admin", email: "admin@test.invalid", role: "ADMIN", name: "Admin" }
const customer = { id: "customer", email: "customer@test.invalid", role: "CUSTOMER", name: "Customer" }
const privateRow = {
  id: "private-order", code: "PRIVATE", userEmail: "another@test.invalid",
  packageName: "Private", gameName: "Game", amount: 10000, quantity: 1,
  status: "PROCESSING", paymentStatus: "PAID", createdAt: "2026-10-14",
  topupInfo: { password: "PRIVATE-TEST-ONLY" },
}

async function inspectStore(page: Page) {
  // Test-only access to context: hidden private data matters even when no UI renders it.
  await page.evaluate(() => {
    window.currentStore = () => {
      const root = document.getElementById("root") as any
      const key = Object.keys(root).find((key) => key.startsWith("__reactContainer$"))!
      const pending = [root[key].stateNode.current]
      while (pending.length) {
        const fiber = pending.pop()
        const value = fiber.memoizedProps?.value
        if (value?.refreshTransactions && value?.logout) return value
        if (fiber.child) pending.push(fiber.child)
        if (fiber.sibling) pending.push(fiber.sibling)
      }
      throw new Error("AppStore context not found")
    }
  })
}

for (const operation of ["restore", "refresh", "login", "profile"] as const) {
  test(`ignores ${operation} responses from an old admin session`, async ({ page }) => {
    let hold = operation === "restore"
    let released!: () => void
    const gate = new Promise<void>((resolve) => { released = resolve })
    let observed!: () => void
    const requested = new Promise<void>((resolve) => { observed = resolve })
    let delayedResponses = 0
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, "")
      const delayed = hold && path === (operation === "profile" ? "/auth/profile" : "/admin/transactions")
      if (delayed) { observed(); await gate }
      let data: unknown = {}
      if (path === "/auth/session" || path === "/auth/profile") data = { user: admin }
      else if (path === "/auth/login") data = { user: route.request().postDataJSON().email === admin.email ? admin : customer }
      else if (path === "/admin/transactions") data = { items: [privateRow], hasNext: false }
      else if (path.endsWith("/users") || path.endsWith("/packages") || path === "/orders/mine") data = { items: [], hasNext: false }
      else if (/\/(services|topup-templates|product-statuses|tags)$/.test(path)) data = []
      else if (path === "/wiki") data = { entries: [], next: null }
      await route.fulfill({ json: { success: true, data } })
      if (delayed) delayedResponses++
    })
    await page.goto("/nap-game")
    await inspectStore(page)
    await expect.poll(() => page.evaluate(() => window.currentStore().user?.role)).toBe("admin")
    if (operation !== "restore") {
      await expect.poll(() => page.evaluate(() => window.currentStore().transactions.length)).toBe(1)
      hold = true
      await page.evaluate((operation) => {
        window.oldStore = window.currentStore()
        window.pendingResult = (operation === "refresh"
          ? window.oldStore.refreshTransactions()
          : operation === "profile" ? window.oldStore.updateProfile("Changed")
          : window.oldStore.login("admin@test.invalid", "test-password", undefined, "admin"))
          .catch(() => "session changed")
      }, operation)
    }
    await requested
    await page.evaluate(async () => { await window.currentStore().logout() })
    await page.evaluate(async () => { await window.currentStore().login("customer@test.invalid", "test-password") })
    released()
    await expect.poll(() => delayedResponses).toBeGreaterThan(0)
    if (operation !== "restore") await page.evaluate(() => window.pendingResult)
    // Let the restored session's fetch continuation and React commit finish as well.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    if (operation === "refresh") {
      expect(await page.evaluate(() => window.pendingResult)).toEqual([])
      await page.evaluate(() => {
        window.oldStore.setUsers([{ id: "private-user" } as any])
        window.oldStore.setTransactions((rows) => [{ id: "private-order" } as any, ...rows])
      })
    }
    await expect.poll(() => page.evaluate(() => ({
      role: window.currentStore().user?.role,
      transactions: window.currentStore().transactions,
      users: window.currentStore().users,
    }))).toEqual({ role: "customer", transactions: [], users: [] })
    expect(await page.evaluate(async () => {
      try { await window.currentStore().login("fake@test.invalid", ""); return "accepted" }
      catch { return "rejected" }
    })).toBe("rejected")
    expect(await page.evaluate(() => window.currentStore().user?.email)).toBe(customer.email)
    if (operation === "refresh") {
      let failLogout!: () => void
      const logoutGate = new Promise<void>((resolve) => { failLogout = resolve })
      await page.route("**/auth/logout", async (route) => {
        await logoutGate
        await route.fulfill({ status: 503, json: { success: false, error: "Test unavailable" } })
      })
      await page.evaluate(() => {
        window.pendingResult = window.currentStore().logout().catch(() => "logout failed")
      })
      expect(await page.evaluate(async () => {
        try { await window.currentStore().login("customer@test.invalid", "test-password"); return "accepted" }
        catch { return "rejected" }
      })).toBe("rejected")
      failLogout()
      expect(await page.evaluate(() => window.pendingResult)).toBe("logout failed")
      // A failed network request releases the auth lock for another attempt.
      await page.evaluate(async () => { await window.currentStore().login("customer@test.invalid", "test-password") })
      expect(await page.evaluate(() => window.currentStore().user?.email)).toBe(customer.email)
    }
  })
}
