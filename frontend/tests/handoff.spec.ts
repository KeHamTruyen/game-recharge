import { test, expect, type Page } from "@playwright/test"

const services = [
  { id: "a", name: "Game Alpha", category: "topup" },
  { id: "b", name: "Game Beta", category: "topup" },
  { id: "boost", name: "Game Boost", category: "boosting" },
].map((service) => ({ ...service, game: service.name, isActive: true, description: "Test game", iconText: "GA", tone: "cyan", sortOrder: 0 }))
const pkg = { id: "pkg-a", serviceId: "a", name: "100 Gems", price: "10000", oldPrice: null, tags: [], isActive: true, statusId: "available", templateId: "tpl" }
const template = { id: "tpl", game: "Game Alpha", name: "Thông tin nạp", fields: [
  { key: "uid", label: "UID", type: "text", required: true, pattern: "^[0-9]{9}$" },
  { key: "server", label: "Server", type: "select", required: true, options: [{ value: "asia", label: "Asia" }] },
] }

async function mockApi(page: Page) {
  // Every API request is intercepted, including mutations. Tests never write real data.
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^\/api/, "")
    let data: unknown = {}
    if (path === "/auth/session") data = { user: { id: "customer", email: "customer@test.invalid", name: "Khách thử nghiệm", role: "CUSTOMER", status: "ACTIVE" } }
    else if (path === "/catalog/services") data = services
    else if (path === "/catalog/topup-templates") data = [template]
    else if (path === "/catalog/product-statuses") data = [{ id: "available", name: "Có sẵn", purchasable: true, color: "green" }]
    else if (path === "/catalog/tags") data = []
    else if (/\/catalog\/services\/.+\/packages/.test(path)) data = { items: path.includes("/a/") ? [pkg] : [], hasNext: false }
    else if (path === "/orders/mine") data = { items: [], hasNext: false }
    else if (path === "/admin/services") data = services
    else if (path === "/admin/packages") data = { items: [pkg], hasNext: false }
    else if (path === "/admin/users" || path === "/admin/transactions") data = { items: [], hasNext: false }
    else if (path === "/wiki") data = { entries: [], next: null }
    else if (route.request().method() !== "GET") {
      await route.fulfill({ status: 503, json: { success: false, error: "Test server unavailable" } })
      return
    }
    await route.fulfill({ json: { success: true, data } })
  })
}

test.beforeEach(async ({ page }) => { await mockApi(page) })

test("service detail follows the URL after selecting a different service", async ({ page }) => {
  await page.goto("/nap-game")
  await page.locator(".service-card").filter({ hasText: "Game Alpha" }).click()
  await expect(page.locator("h1")).toContainText("Game Alpha")
  await page.evaluate(() => {
    window.history.pushState(null, "", "/nap-game/b")
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  await expect(page.locator("h1")).toContainText("Game Beta")
})

test("checkout submits select values and does not claim payment on API failure", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/nap-game/a")
  await page.locator(".package-card").click()
  await page.locator(".cart-button").click()
  await page.getByLabel("UID").fill("800123456")
  await page.getByLabel("Server").selectOption({ label: "Asia" })
  await expect(page.getByLabel("Server")).toHaveValue("asia")
  await page.locator(".dynamic-topup-form button[type=submit]").click()
  await page.locator(".confirmation-modal .primary-button").click()
  await expect(page).toHaveURL(/thanh-toan/)
  const request = page.waitForRequest((req) => req.url().includes("/orders/checkout"))
  await page.getByRole("button", { name: "Tạo đơn hàng" }).click()
  expect((await request).postDataJSON().topupInfo.server).toBe("asia")
  await expect(page.getByText("Test server unavailable")).toBeVisible()
  await expect(page.getByRole("button", { name: "Tạo đơn hàng" })).toBeEnabled()
  await expect(page.getByText("Đã nhận thanh toán", { exact: true })).toHaveCount(0)
  // Remove the cart after going back: the route must redirect without a hooks error.
  await page.locator(".checkout-back").click()
  await page.locator(".cart-remove").click()
  await expect(page).toHaveURL(/nap-game$/)
  expect(errors).toEqual([])
})

test("giftcode failure retains the contribution and never shows success", async ({ page }) => {
  await page.goto("/wiki/giftcode")
  await page.locator(".giftcode-action-bar button").last().click()
  await page.locator(".modal-backdrop input").first().fill("TESTCODE")
  await page.locator(".modal-backdrop input").nth(1).fill("100 Gems")
  await page.locator(".modal-backdrop button[type=submit]").click()
  await expect(page.getByText("Test server unavailable")).toBeVisible()
  await expect(page.locator(".modal-backdrop input").first()).toHaveValue("TESTCODE")
  await expect(page.getByText("Cảm ơn bạn đã đóng góp!")).toHaveCount(0)
})

test("Aniimo detail opens and closes without changing hook order", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/wiki/list")
  await page.locator(".aniimo-card").first().click()
  await expect(page.locator(".aniimo-modal-container")).toBeVisible()
  await page.locator(".modal-backdrop").click({ position: { x: 5, y: 5 } })
  await expect(page.locator(".aniimo-modal-container")).toHaveCount(0)
  expect(errors).toEqual([])
})

test("team publication uses the server ID and can update the same saved team", async ({ page }) => {
  const saved: Record<string, unknown>[] = []
  await page.route("**/api/wiki", (route) => route.fulfill({ json: { success: true, data: { entries: saved, next: null } } }))
  await page.route("**/api/wiki/teams**", async (route) => {
    const data = { ...route.request().postDataJSON(), id: 1234567, user_id: "customer", nickname: "Khách thử nghiệm", isCommunity: true, avg_stars: 0, total_ratings: 0 }
    const entry = { key: "team:1234567", kind: "team", authorId: "customer", deleted: false, data }
    saved.splice(0, saved.length, entry)
    await route.fulfill({ status: 201, json: { success: true, data: entry } })
  })
  await page.goto("/wiki/build")
  for (let i = 0; i < 4; i += 1) {
    await page.locator(".builder-slot").nth(i).click()
    await page.locator(".selector-item").nth(i).click()
  }
  await page.locator(".publish-field input").fill("Browser regression team")
  await page.locator(".publish-btn").click()
  await expect(page.locator(".edit-mode-save-btn")).toContainText("1234567")
  const update = page.waitForRequest((request) => request.method() === "PUT" && request.url().endsWith("/wiki/teams/1234567"))
  await page.locator(".edit-mode-save-btn").click()
  await update
})

test("catalog fetches the next page instead of silently hiding packages after 100", async ({ page }) => {
  await page.route("**/api/catalog/services/a/packages?**", async (route) => {
    const secondPage = new URL(route.request().url()).searchParams.get("page") === "2"
    await route.fulfill({ json: { success: true, data: { items: [{ ...pkg, id: secondPage ? "pkg-101" : "pkg-1", name: secondPage ? "Last Package" : "First Package" }], hasNext: !secondPage } } })
  })
  await page.goto("/nap-game/a")
  await expect(page.locator(".package-card").filter({ hasText: "Last Package" })).toBeVisible()
})

test("catalog errors show retry without displaying mock products", async ({ page }) => {
  await page.route("**/api/catalog/services", (route) => route.fulfill({ status: 503, json: { success: false, error: "Unavailable" } }))
  await page.goto("/nap-game")
  await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible()
  await expect(page.locator(".service-card")).toHaveCount(0)
})

test("unknown routes stay on 404 and are excluded from indexing", async ({ page }) => {
  await page.goto("/does-not-exist")
  await expect(page.getByRole("heading", { name: /404/ })).toBeVisible()
  await expect(page).toHaveURL(/does-not-exist$/)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow")
  await page.goto("/wiki/stats")
  await expect(page).toHaveURL(/wiki\/so-sanh$/)
})

test("admin contact edits are drafts and preserve text after save failure", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { success: true, data: { user: { id: "admin", email: "admin@test.invalid", name: "Admin", role: "ADMIN", status: "ACTIVE" } } } }))
  const writes: string[] = []
  page.on("request", (request) => { if (request.method() === "PUT") writes.push(request.url()) })
  await page.goto("/admin")
  await page.getByRole("button", { name: "Trang liên hệ", exact: true }).click()
  await page.getByRole("textbox", { name: "Giới thiệu", exact: true }).fill("Draft contact introduction")
  expect(writes).toEqual([])
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click()
  await expect(page.getByText("Test server unavailable")).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Giới thiệu", exact: true })).toHaveValue("Draft contact introduction")
  expect(writes).toHaveLength(1)
  await page.getByRole("button", { name: "Wiki Aniimo", exact: true }).click()
  await expect(page.locator(".admin-wiki-manager")).toBeVisible()
})

for (const width of [390, 820]) {
  test(`mobile navigation remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto("/nap-game")
    const navigation = page.getByRole("navigation", { name: "Điều hướng di động" })
    await expect(navigation).toBeVisible()
    await expect(navigation.getByRole("link", { name: "Cày thuê" })).toBeVisible()
    await navigation.getByRole("link", { name: "Cày thuê" }).click()
    await expect(page).toHaveURL(/cay-thue$/)
    await expect(page.locator(".service-card").filter({ hasText: "Game Boost" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
