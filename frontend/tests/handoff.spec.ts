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

test.describe("admin mutation errors", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/session", route => route.fulfill({ json: { success: true, data: {
      user: { id: "admin", email: "admin@test.invalid", name: "Admin", role: "ADMIN", status: "ACTIVE" },
    } } }));
    await page.route("**/api/admin/**", route => route.request().method() === "GET"
      ? route.fallback()
      : route.fulfill({ status: 400, json: { success: false, error: "Action rejected by server" } }));
    page.on("dialog", dialog => dialog.accept("Test reason"));
  });

  test("order status rejection is visible, preserves status and allows a successful retry", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const order = { id: "order", code: "DUKETEST", userEmail: "customer@test.invalid", gameName: "Game Alpha",
      packageName: "100 Gems", amount: "10000", quantity: 1, status: "PENDING", paymentStatus: "PENDING",
      createdAt: new Date().toISOString(), topupInfo: {} };
    await page.route("**/api/admin/transactions?*", route => route.fulfill({ json: {
      success: true, data: { items: [order], hasNext: false },
    } }));
    await page.goto("/admin");
    await page.getByRole("button", { name: "Giao dịch", exact: true }).click();
    const status = page.locator("select.transaction-status");
    await status.selectOption({ label: "Hoàn thành" });
    await expect(page.getByRole("alert")).toHaveText("Action rejected by server");
    await expect(status).toHaveValue("Chờ thanh toán");
    await page.route("**/api/admin/transactions/order/status", route => route.fulfill({ json: {
      success: true, data: { ...order, status: "FAILED" },
    } }));
    await status.selectOption({ label: "Thất bại" });
    await expect(status).toHaveValue("Thất bại");
    expect(errors).toEqual([]);
  });

  test("user block rejection leaves the account active", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/admin/users?*", route => route.fulfill({ json: { success: true, data: {
      items: [{ id: "customer", email: "customer@test.invalid", name: "Test User", role: "CUSTOMER",
        status: "ACTIVE", totalSpent: "0", createdAt: new Date().toISOString() }], hasNext: false,
    } } }));
    await page.goto("/admin");
    await page.getByRole("button", { name: "Người dùng", exact: true }).click();
    await page.locator(".user-status").click();
    await expect(page.getByRole("alert")).toHaveText("Action rejected by server");
    await expect(page.locator(".user-status")).toHaveText("Đang hoạt động");
    expect(errors).toEqual([]);
  });

  test("tag rename retains its draft when saving is rejected", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const path of ["catalog/tags", "admin/tags"]) {
      await page.route(`**/api/${path}`, route => route.fulfill({ json: {
        success: true, data: [{ id: "tag", name: "Existing tag" }],
      } }));
    }
    await page.goto("/admin");
    await page.getByRole("button", { name: "Danh mục & tag", exact: true }).click();
    await page.getByRole("button", { name: "Sửa tag Existing tag", exact: true }).click();
    await page.locator(".tag-manager-edit-form input").fill("New tag name");
    await page.locator(".tag-manager-edit-form button[type=submit]").click();
    await expect(page.getByRole("alert")).toHaveText("Action rejected by server");
    await expect(page.locator(".tag-manager-edit-form input")).toHaveValue("New tag name");
    expect(errors).toEqual([]);
  });

  test("game creation retry only creates the service that failed", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const categories: string[] = [];
    await page.route("**/api/admin/services", async route => {
      if (route.request().method() !== "POST") return route.fallback();
      const body = route.request().postDataJSON();
      categories.push(body.category);
      if (categories.length === 2) return route.fulfill({ status: 503, json: { success: false, error: "Partial creation failed" } });
      return route.fulfill({ json: { success: true, data: { ...body, id: body.category } } });
    });
    await page.goto("/admin");
    await page.getByRole("button", { name: "Danh sách game", exact: true }).click();
    await page.getByLabel("Tên game mới", { exact: true }).fill("Partial game");
    await page.getByLabel("Tạo mục Nạp game").check();
    await page.getByLabel("Tạo mục Cày thuê").check();
    const submit = page.locator(".game-add-form button").last();
    await submit.click();
    await expect(page.getByRole("alert")).toHaveText("Partial creation failed");
    await expect(page.getByLabel("Tên game mới", { exact: true })).toHaveValue("Partial game");
    await submit.click();
    await expect(page.getByLabel("Tên game mới", { exact: true })).toHaveValue("");
    expect(categories).toEqual(["topup", "boosting", "boosting"]);
    expect(errors).toEqual([]);
  });

  for (const action of ["Ẩn gói nạp", "Xóa 100 Gems"]) {
    test(`product action ${action} reports failure without removing the product`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("/admin");
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(page.getByRole("alert")).toHaveText("Action rejected by server");
      await expect(page.getByRole("button", { name: "Ẩn gói nạp", exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  for (const form of [
    { tab: "Trạng thái sản phẩm", field: "Tên trạng thái", selector: ".status-create-form" },
    { tab: "Danh mục & tag", field: "Tên tag mới", selector: ".category-form" },
    { tab: "Danh sách game", field: "Tên game mới", selector: ".game-add-form" },
  ]) {
    test(`${form.tab} retains draft on failure and clears it only after success`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("/admin");
      await page.getByRole("button", { name: form.tab, exact: true }).click();
      const field = page.getByLabel(form.field, { exact: true });
      await field.fill("Draft value");
      await page.locator(form.selector).locator("button").last().click();
      await expect(page.getByRole("alert")).toHaveText("Action rejected by server");
      await expect(field).toHaveValue("Draft value");
      await page.route("**/api/admin/**", async route => {
        if (route.request().method() !== "POST") return route.fallback();
        return route.fulfill({ json: { success: true, data: { ...route.request().postDataJSON(), id: "created" } } });
      });
      await page.locator(form.selector).locator("button").last().click();
      await expect(field).toHaveValue("");
      expect(errors).toEqual([]);
    });
  }
});

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
  await expect(page.getByText("Test server unavailable").first()).toBeVisible()
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

test("catalog fetches beyond 500 packages without silently hiding the last page", async ({ page }) => {
  await page.route(/\/api\/catalog\/services\/a\/packages/, async (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get("page"))
    const items = Array.from({ length: pageNumber < 6 ? 100 : 1 }, (_, i) => ({
      ...pkg, id: `pkg-${(pageNumber - 1) * 100 + i}`, name: pageNumber === 6 ? "Last Package" : `Package ${pageNumber}-${i}`,
    }))
    await route.fulfill({ json: { success: true, data: { items, hasNext: pageNumber < 6 } } })
  })
  await page.goto("/nap-game/a")
  await expect(page.locator(".package-card").filter({ hasText: "Last Package" })).toBeVisible()
})

test("order and admin lists retain record 501", async ({ page }) => {
  await page.route(/\/api\/(orders\/mine|admin\/(transactions|users))\?/, async (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get("page"))
    const items = Array.from({ length: pageNumber < 6 ? 100 : 1 }, (_, i) => ({
      id: String((pageNumber - 1) * 100 + i), code: "TEST", amount: 10000,
      status: "PENDING", createdAt: "2026-01-01T00:00:00Z", role: "CUSTOMER", totalSpent: 0,
    }))
    await route.fulfill({ json: { success: true, data: { items, hasNext: pageNumber < 6 } } })
  })
  await page.goto("/nap-game")
  const counts = await page.evaluate(async () => {
    const modulePath = "/src/services/api.ts"
    const { api } = await import(modulePath)
    return Promise.all([api.orders.mine(), api.admin.transactions(), api.admin.users()]).then((lists) => lists.map((list) => list.length))
  })
  expect(counts).toEqual([501, 501, 501])
})

test("wiki tombstones remove built-in giftcodes, teams and guides without exposing deleted reviews", async ({ page }) => {
  await page.goto("/wiki/giftcode")
  const keys = await page.evaluate(async () => {
    const modulePath = "/src/features/wiki/wikiData.ts"
    const data = await import(modulePath)
    return [
      `giftcode:${data.getEffectiveGiftcodes()[0].id}`,
      `team:${data.getEffectiveCommunityTeams()[0].id}`,
      `guide:${data.getEffectiveGuides()[0].id}`,
    ]
  })
  await page.route("**/api/wiki*", (route) => route.fulfill({ json: { success: true, data: {
    entries: [...keys, "review:test"].map((key) => ({ key, kind: key.split(":")[0], deleted: true, authorId: null, data: {} })), next: null,
  } } }))
  const result = await page.evaluate(async (keys) => {
    const storePath = "/src/features/wiki/wikiStore.ts"
    const dataPath = "/src/features/wiki/wikiData.ts"
    const store = await import(storePath)
    const data = await import(dataPath)
    await store.refreshWiki(true)
    return {
      visible: [data.getEffectiveGiftcodes(), data.getEffectiveCommunityTeams(), data.getEffectiveGuides()]
        .map((items, index) => items.some((item: { id: string | number }) => String(item.id) === keys[index].split(":")[1])),
      reviews: store.getWikiEntries("review").length,
    }
  }, keys)
  expect(result).toEqual({ visible: [false, false, false], reviews: 0 })
})

test("library download failure shows retry and recovers after reload", async ({ page }) => {
  let fail = true
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.route("**/library_items_full.json*", (route) => fail ? route.abort() : route.continue())
  await page.goto("/wiki/thu-vien")
  await expect(page.getByRole("alert")).toContainText("Không thể tải thư viện")
  fail = false
  await page.getByRole("button", { name: "Thử lại", exact: true }).click()
  await expect(page.locator(".library-item-card").first()).toBeVisible()
  await expect(page.getByRole("alert")).toHaveCount(0)
  expect(errors).toEqual([])
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

test("payment reconciliation retains the note on failure and confirms only after saving", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { success: true, data: {
    user: { id: "admin", email: "admin@test.invalid", name: "Admin", role: "ADMIN", status: "ACTIVE" },
  } } }));
  const anomaly = { id: "anomaly-test", provider: "sepay", gatewayId: "123", referenceCode: "REF-TEST",
    orderCode: "DUKETEST", accountNumber: "0000", amount: 10000, expectedAmount: 10000,
    content: "DUKETEST", anomalyType: "DUPLICATE_PAYMENT", rawPayload: null,
    resolved: false, resolvedBy: null, resolvedAt: null, resolutionNote: "", createdAt: new Date().toISOString() };
  let allowSave = false;
  await page.route("**/api/admin/payment-anomalies**", (route) => {
    if (route.request().method() === "PATCH") {
      if (!allowSave) return route.fulfill({ status: 503, json: { success: false, error: "Save unavailable" } });
      anomaly.resolved = true;
      anomaly.resolutionNote = route.request().postDataJSON().resolutionNote;
      return route.fulfill({ json: { success: true, data: anomaly } });
    }
    return route.fulfill({ json: { success: true, data: { items: [anomaly], total: 1, totalPages: 1 } } });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/admin");
  await page.getByRole("button", { name: "Đối soát thanh toán", exact: true }).click();
  await expect(page.getByText("Chuyển trùng (2 lần)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Xử lý", exact: true }).click();
  const save = page.getByRole("button", { name: "Xác nhận đã giải quyết", exact: true });
  await expect(save).toBeDisabled();
  await page.locator(".product-modal textarea").fill("Payment reconciled manually");
  await save.click();
  await expect(save).toBeEnabled();
  await expect(page.locator(".product-modal textarea")).toHaveValue("Payment reconciled manually");
  await expect(page.getByText("Đã xử lý", { exact: true })).toHaveCount(0);
  allowSave = true;
  await save.click();
  await expect(page.locator(".product-modal")).toHaveCount(0);
  await expect(page.getByText("Đã xử lý", { exact: true })).toBeVisible();
});

test("template deletion is disabled for packages in use", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { success: true, data: {
    user: { id: "admin", email: "admin@test.invalid", name: "Admin", role: "ADMIN", status: "ACTIVE" },
  } } }))
  await page.goto("/admin")
  await page.getByRole("button", { name: "Mẫu thông tin nạp", exact: true }).click()
  await expect(page.getByRole("button", { name: `Xóa mẫu ${template.name}`, exact: true })).toBeDisabled()
  await page.locator(".template-card").getByRole("button", { name: "Sửa", exact: true }).click()
  await expect(page.getByRole("button", { name: "Xóa mẫu", exact: true })).toBeDisabled()
})

test("template deletion preserves the editor on server rejection and closes only after success", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { success: true, data: {
    user: { id: "admin", email: "admin@test.invalid", name: "Admin", role: "ADMIN", status: "ACTIVE" },
  } } }))
  await page.route("**/api/admin/packages?*", (route) => route.fulfill({ json: { success: true, data: { items: [], hasNext: false } } }))
  let attempts = 0
  await page.route("**/api/admin/topup-templates/tpl", (route) => {
    attempts += 1
    return route.fulfill(attempts === 1
      ? { status: 409, json: { success: false, error: "Template is now in use" } }
      : { json: { success: true, data: { message: "Template deleted" } } })
  })
  page.on("dialog", (dialog) => dialog.accept())
  await page.goto("/admin")
  await page.getByRole("button", { name: "Mẫu thông tin nạp", exact: true }).click()
  await page.locator(".template-card").getByRole("button", { name: "Sửa", exact: true }).click()
  await page.getByLabel("Tên mẫu", { exact: true }).fill("Unsaved template draft")
  await page.getByRole("button", { name: "Xóa mẫu", exact: true }).click()
  await expect(page.getByText("Template is now in use", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Tên mẫu", { exact: true })).toHaveValue("Unsaved template draft")
  await expect(page.locator(".template-card")).toHaveCount(1)
  await page.getByRole("button", { name: "Xóa mẫu", exact: true }).click()
  await expect(page.locator(".template-editor")).toHaveCount(0)
  await expect(page.locator(".template-card")).toHaveCount(0)
  expect(attempts).toBe(2)
})

for (const width of [390, 820]) {
  test(`mobile navigation remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto("/nap-game")
    const navigation = page.getByRole("navigation", { name: "Điều hướng di động" })
    await expect(navigation).toBeVisible()
    const cayThueBtn = navigation.locator("button, a").filter({ hasText: "Cày thuê" })
    await expect(cayThueBtn).toBeVisible()
    await cayThueBtn.click()
    await expect(page).toHaveURL(/cay-thue$/)
    await expect(page.locator(".service-card").filter({ hasText: "Game Boost" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

for (const committed of [true, false]) {
  test(`checkout recovers a lost response after reload (committed=${committed})`, async ({ page }) => {
    const payment = {
      orderCode: "RECOVERED_ORDER", amount: 10000, bankCode: "TEST", accountNumber: "0000",
      accountName: "TEST", transferContent: "RECOVERED_ORDER", qrCode: "", checkoutUrl: "",
    };
    const keys: string[] = [];
    let recoveryUnavailable = true;
    await page.route("**/api/orders/checkout", async (route) => {
      const key = route.request().headers()["idempotency-key"];
      if (route.request().method() === "GET") {
        expect(key).toBe(keys[0]);
        if (recoveryUnavailable) return route.fulfill({ status: 503, json: { success: false } });
        return route.fulfill({ json: { success: true, data: { payment: committed ? payment : null } } });
      }
      keys.push(key);
      if (keys.length === 1) return route.abort("failed");
      return route.fulfill({ json: { success: true, data: { transactions: [], payment } } });
    });
    await page.route("**/api/payments/status/*", (route) => route.fulfill({ json: {
      success: true, data: { paymentStatus: "PENDING" },
    } }));
    await page.goto("/nap-game/a");
    await page.locator(".account-nav-button.signed-in").waitFor({ state: "attached" });
    await page.locator(".package-card").click();
    await page.locator(".cart-button").click();
    const submit = async () => {
      await page.getByLabel("UID").fill("800123456");
      await page.getByLabel("Server").selectOption("asia");
      await page.locator(".dynamic-topup-form button[type=submit]").click();
      await page.locator(".confirmation-modal .primary-button").click();
    };
    await submit();
    await page.locator(".confirm-payment").click();
    await expect.poll(() => keys.length).toBe(1);
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("tránh tạo đơn trùng");
    await expect(page.locator(".confirm-payment")).toHaveCount(0);
    recoveryUnavailable = false;
    await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    if (!committed) {
      await expect(page).toHaveURL(/nap-game\/thong-tin/);
      await submit();
      await page.locator(".confirm-payment").click();
    }
    await expect(page.getByText("RECOVERED_ORDER", { exact: true }).first()).toBeVisible();
    expect(keys.length).toBe(committed ? 1 : 2);
    expect(new Set(keys).size).toBe(1);
    expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain("800123456");
  });
}

for (const key of ["password", "credential"]) {
  test(`checkout keeps ${key} out of storage, restores payment and invalidates edits`, async ({ page }) => {
    await page.route("**/api/catalog/topup-templates", (route) => route.fulfill({ json: { success: true, data: [{
      id: "tpl", name: "Test", game: "Game Alpha", fields: [
        { key: "uid", label: "UID", type: "text", required: true },
        { key, label: "Credential", type: "password", required: true },
      ],
    }] } }));
    let created = 0;
    const checkoutKeys: string[] = [];
    await page.route("**/api/orders/checkout", (route) => {
      created += 1;
      checkoutKeys.push(route.request().headers()["idempotency-key"]);
      return route.fulfill({ json: { success: true, data: { transactions: [], payment: {
        orderCode: "DUMMY_ORDER_1", amount: 10000, bankCode: "TEST", accountNumber: "0000",
        accountName: "DUMMY", transferContent: "DUMMY_ORDER_1", qrCode: "", checkoutUrl: "",
      } } } });
    });
    await page.route("**/api/payments/status/*", (route) => route.fulfill({ json: {
      success: true, data: { paymentStatus: "PENDING" },
    } }));
    await page.goto("/nap-game/a");
    await page.locator(".account-nav-button.signed-in").waitFor({ state: "attached" });
    await page.locator(".package-card").click();
    await page.locator(".cart-button").click();
    const submit = async (password: string) => {
      await page.getByLabel("UID").fill("800123456");
      await page.getByLabel("Credential").fill(password);
      await page.locator(".dynamic-topup-form button[type=submit]").click();
      await page.locator(".confirmation-modal .primary-button").click();
    };
    await submit("DummyPass123");
    await page.locator(".confirm-payment").click();
    await expect(page.getByText("DUMMY_ORDER_1", { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain("DummyPass123");
    await page.locator(".checkout-back").click();
    await submit(" DummyPass123 ");
    await expect(page.getByText("DUMMY_ORDER_1", { exact: true })).toHaveCount(0);
    await page.locator(".confirm-payment").click();
    await expect(page.getByText("DUMMY_ORDER_1", { exact: true }).first()).toBeVisible();
    await page.evaluate(() => {
      sessionStorage.setItem("duke1305_checkout_info", JSON.stringify({ credential: "DummyPass123" }));
      sessionStorage.setItem("duke1305_checkout_key_sig", "legacy:DummyPass123");
      const payment = JSON.parse(sessionStorage.getItem("duke1305_checkout_payment")!);
      payment.topupSignature = JSON.stringify({ credential: "DummyPass123" });
      sessionStorage.setItem("duke1305_checkout_payment", JSON.stringify(payment));
    });
    await page.reload();
    await expect(page.getByText("DUMMY_ORDER_1", { exact: true }).first()).toBeVisible();
    expect(created).toBe(2);
    expect(new Set(checkoutKeys).size).toBe(2);
    expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain("DummyPass123");
  });
}

test("checkout polling detects late payment on cancelled order and notifies user to contact CSKH", async ({ page }) => {
  await page.route("**/api/orders/checkout", (route) => route.fulfill({
    json: {
      success: true,
      data: {
        transactions: [],
        payment: {
          orderCode: "CANCELLED_ORDER_1",
          amount: 10000,
          bankCode: "TEST",
          accountNumber: "0000",
          accountName: "TEST",
          transferContent: "CANCELLED_ORDER_1",
          qrCode: "",
          checkoutUrl: "",
        },
      },
    },
  }));
  await page.route("**/api/payments/status/*", (route) => route.fulfill({
    json: {
      success: true,
      data: {
        paymentStatus: "PAID",
        status: "FAILED",
        paidAt: new Date().toISOString(),
      },
    },
  }));
  await page.goto("/nap-game/a");
  await page.locator(".account-nav-button.signed-in").waitFor({ state: "attached" });
  await page.locator(".package-card").click();
  await page.locator(".cart-button").click();
  await page.getByLabel("UID").fill("800123456");
  await page.getByLabel("Server").selectOption("asia");
  await page.locator(".dynamic-topup-form button[type=submit]").click();
  await page.locator(".confirmation-modal .primary-button").click();
  await page.locator(".confirm-payment").click();
  await expect(page.getByText("Đã nhận tiền, đơn đã hủy — liên hệ CSKH")).toBeVisible();
});
