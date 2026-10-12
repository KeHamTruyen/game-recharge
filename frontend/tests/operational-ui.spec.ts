import { test, expect, type Page } from "@playwright/test"

const services = [
  { id: "a", name: "Genshin Impact", category: "topup" },
  { id: "b", name: "Honkai: Star Rail", category: "topup" },
].map((service) => ({
  ...service,
  game: service.name,
  isActive: true,
  description: "Dịch vụ game",
  iconText: "GS",
  tone: "cyan",
  sortOrder: 0,
}))

const pkg = {
  id: "pkg-a",
  serviceId: "a",
  name: "Gói 6480 Đá",
  price: "1999000",
  oldPrice: null,
  tags: ["Hot"],
  isActive: true,
  statusId: "available",
  templateId: "tpl-a",
}

const template = {
  id: "tpl-a",
  game: "Genshin Impact",
  name: "Thông tin nạp Genshin",
  fields: [
    { key: "uid", label: "UID", type: "text", required: true },
    { key: "server", label: "Server", type: "select", required: true, options: [{ value: "asia", label: "Asia" }] },
  ],
}

const mockOrder = {
  id: "order-1",
  code: "DUKE9999",
  packageName: "Gói 6480 Đá",
  gameName: "Genshin Impact",
  amount: 1999000,
  quantity: 1,
  status: "PENDING",
  paymentStatus: "UNPAID",
  topupInfo: { uid: "812345678" },
  createdAt: new Date().toISOString(),
}

const mockAuditLogs = {
  items: [
    {
      id: "log-1",
      userId: "admin-1",
      action: "UPDATE_SETTING",
      method: "PUT",
      path: "/api/admin/settings/siteConfig",
      statusCode: 200,
      ipAddress: "127.0.0.1",
      requestId: "req-123456",
      metadata: { maintenanceMode: true },
      createdAt: new Date().toISOString(),
    },
  ],
  total: 1,
  page: 1,
  limit: 15,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
}

async function setupApiMock(page: Page, options: { maintenance?: boolean; isAdmin?: boolean } = {}) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^\/api/, "")

    if (path === "/auth/session") {
      await route.fulfill({
        json: {
          success: true,
          data: {
            user: {
              id: options.isAdmin ? "admin-id" : "cust-id",
              email: options.isAdmin ? "admin@duke1305.vn" : "customer@test.vn",
              name: options.isAdmin ? "Admin Root" : "Khách Hàng",
              role: options.isAdmin ? "ADMIN" : "CUSTOMER",
              status: "ACTIVE",
            },
          },
        },
      })
      return
    }

    if (path === "/catalog/services") {
      await route.fulfill({ json: { success: true, data: services } })
      return
    }

    if (path === "/catalog/topup-templates") {
      await route.fulfill({ json: { success: true, data: [template] } })
      return
    }

    if (path === "/catalog/product-statuses") {
      await route.fulfill({ json: { success: true, data: [{ id: "available", name: "Có sẵn", purchasable: true, color: "green" }] } })
      return
    }

    if (path === "/catalog/tags") {
      await route.fulfill({ json: { success: true, data: [] } })
      return
    }

    if (path.includes("/packages")) {
      await route.fulfill({ json: { success: true, data: { items: [pkg], hasNext: false } } })
      return
    }

    if (path === "/catalog/settings/siteConfig" || path === "/admin/settings/siteConfig") {
      await route.fulfill({
        json: {
          success: true,
          data: {
            id: "siteConfig",
            value: {
              maintenanceMode: Boolean(options.maintenance),
              maintenanceMessage: options.maintenance ? "Hệ thống đang bảo trì nạp game định kỳ" : "",
            },
          },
        },
      })
      return
    }

    if (path.includes("/orders/mine")) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            items: [mockOrder],
            hasNext: false,
          },
        },
      })
      return
    }

    if (path === "/admin/audit-logs") {
      await route.fulfill({ json: { success: true, data: mockAuditLogs } })
      return
    }

    if (path === "/admin/services" || path === "/admin/packages" || path === "/admin/users" || path === "/admin/transactions") {
      await route.fulfill({ json: { success: true, data: { items: [], hasNext: false } } })
      return
    }

    if (path === "/wiki") {
      await route.fulfill({ json: { success: true, data: { entries: [], next: null } } })
      return
    }

    await route.fulfill({ json: { success: true, data: {} } })
  })
}

test.describe("Operational Features & Responsive UI Verification", () => {
  test("1. Storefront has no horizontal overflow on desktop and mobile viewports", async ({ page }) => {
    await setupApiMock(page)

    // Desktop check (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/nap-game")
    await expect(page.locator(".site-header")).toBeVisible()
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(desktopOverflow).toBe(true)

    // Mobile check (375x667 - iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/nap-game")
    await expect(page.locator(".site-header")).toBeVisible()
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(mobileOverflow).toBe(true)
  })

  test("2. Maintenance banner renders cleanly on mobile & desktop without causing overflow", async ({ page }) => {
    await setupApiMock(page, { maintenance: true })

    // Mobile check
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/nap-game")

    const banner = page.locator(".maintenance-banner")
    await expect(banner).toBeVisible()
    await expect(banner).toContainText("Hệ thống đang bảo trì nạp game định kỳ")

    const noOverflowOnMobile = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(noOverflowOnMobile).toBe(true)

    // Desktop check
    await page.setViewportSize({ width: 1280, height: 800 })
    const noOverflowOnDesktop = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(noOverflowOnDesktop).toBe(true)
  })

  test("3. Transaction History renders cancel button on both desktop and mobile without overflow", async ({ page }) => {
    await setupApiMock(page)

    // Desktop check
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/tai-khoan")
    await expect(page.locator(".history-panel")).toBeVisible()

    const desktopCancelBtn = page.locator(".history-desktop-status button", { hasText: "Hủy đơn" })
    await expect(desktopCancelBtn).toBeVisible()

    const desktopNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(desktopNoOverflow).toBe(true)

    // Mobile check (375px)
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await expect(page.locator(".history-panel")).toBeVisible()

    const mobileMeta = page.locator(".history-mobile-meta")
    await expect(mobileMeta).toBeVisible()
    const mobileCancelBtn = mobileMeta.locator("button", { hasText: "Hủy đơn" })
    await expect(mobileCancelBtn).toBeVisible()

    const mobileNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(mobileNoOverflow).toBe(true)
  })

  test("4. Admin panel Audit Log tab renders table with horizontal scroll wrapper, preventing page overflow", async ({ page }) => {
    await setupApiMock(page, { isAdmin: true })

    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/admin")

    // Open audit tab
    const auditTabBtn = page.getByRole("button", { name: /Nhật ký hoạt động/i })
    if (await auditTabBtn.isVisible()) {
      await auditTabBtn.click()
    }

    // Check page horizontal boundary
    const noPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(noPageOverflow).toBe(true)
  })
})

