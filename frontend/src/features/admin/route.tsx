import { useNavigate } from "react-router"
import { useAppStore } from "@/app/AppStore"
import { AdminHeader, AdminLogin, AdminPage } from "@/features/admin"
import { api } from "@/services/api"

export function AdminRoute() {
  const store = useAppStore()
  const navigate = useNavigate()

  if (store.user?.role !== "admin" && store.user?.role !== "staff") {
    return (
      <div className="app-shell admin-shell">
        <AdminLogin
          onLogin={async (email, password) => {
            const user = await store.login(email, password)
            if (user.role !== "admin" && user.role !== "staff") {
              await store.logout()
              store.setNotice("Tài khoản không có quyền quản trị.")
            }
          }}
          onStore={() => navigate("/nap-game")}
        />
        {store.notice && <div className="toast">{store.notice}</div>}
      </div>
    )
  }

  return (
    <div className="app-shell admin-shell">
      <AdminHeader
        email={store.user.email}
        onStore={() => navigate("/nap-game")}
        onLogout={() => store.logout()}
      />
      <AdminPage
        products={store.products}
        services={store.services}
        categories={store.categories}
        games={store.games}
        productStatuses={store.productStatuses}
        topupTemplates={store.topupTemplates}
        onAddProduct={async (product) => {
          const service = store.services.find((item) => item.name === product.game || item.game === product.game)
          if (!service) throw new Error("Không tìm thấy dịch vụ tương ứng.")
          const created = await api.admin.createPackage({
            serviceId: String(service.id),
            name: product.name,
            description: "",
            price: product.price,
            oldPrice: product.oldPrice || null,
            note: product.note,
            tags: product.tags,
            statusId: product.statusId,
            templateId: product.templateId,
            sortOrder: 0,
            isActive: true,
          })
          store.setServicePackages((current) => [created, ...current])
          store.setProducts((current) => [{ ...product, id: created.id }, ...current])
        }}
        onDeleteProduct={async (id) => {
          await api.admin.deletePackage(id)
          store.setServicePackages((current) => current.filter((item) => item.id !== id))
          store.setProducts((current) => current.filter((item) => item.id !== id))
        }}
        onUpdateProduct={async (id, updates) => {
          const updated = await api.admin.updatePackage(id, {
            name: updates.name,
            price: updates.price,
            oldPrice: updates.oldPrice || null,
            note: updates.note,
            tags: updates.tags,
            statusId: updates.statusId,
            templateId: updates.templateId,
          })
          store.setServicePackages((current) => current.map((item) => item.id === id ? updated : item))
          store.setProducts((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item))
        }}
        onAddProductStatus={async (status) => {
          const created = await api.admin.createStatus(status)
          store.setProductStatuses((current) => [...current, created])
        }}
        onDeleteProductStatus={async (id) => {
          const fallback = store.productStatuses.find((item) => item.id !== id)?.id || "available"
          await api.admin.deleteStatus(id)
          store.setProductStatuses((current) =>
            current.filter((item) => item.id !== id),
          )
          await Promise.all(
            store.servicePackages
              .filter((item) => item.statusId === id)
              .map((item) => api.admin.updatePackage(item.id, { statusId: fallback })),
          )
          store.setServicePackages((current) =>
            current.map((item) => item.statusId === id ? { ...item, statusId: fallback } : item),
          )
          store.setProducts((current) =>
            current.map((item) =>
              item.statusId === id ? { ...item, statusId: fallback } : item,
            ),
          )
        }}
        onAddTopupTemplate={async (template) => {
          const created = await api.admin.createTemplate(template)
          store.setTopupTemplates((current) => [...current, created])
        }}
        onUpdateTopupTemplate={async (id, template) => {
          const updated = await api.admin.updateTemplate(id, template)
          store.setTopupTemplates((current) =>
            current.map((item) => (item.id === id ? updated : item)),
          )
        }}
        onDeleteTopupTemplate={async (id) => {
          await api.admin.deleteTemplate(id)
          const fallback =
            store.topupTemplates.find((item) => item.id !== id)?.id || ""
          store.setTopupTemplates((current) =>
            current.filter((item) => item.id !== id),
          )
          store.setProducts((current) =>
            current.map((item) =>
              item.templateId === id ? { ...item, templateId: fallback } : item,
            ),
          )
        }}
        onAddCategory={(name) =>
          store.setCategories((current) =>
            current.includes(name) ? current : [...current, name],
          )
        }
        onDeleteCategory={(name) =>
          store.setCategories((current) =>
            current.filter((item) => item === "Tất cả" || item !== name),
          )
        }
        onAddGame={async (name) => {
          if (store.services.some((item) => item.name === name || item.game === name)) return
          const service = await api.admin.createService({
            name,
            game: name,
            description: "",
            iconText: name.slice(0, 3).toUpperCase(),
            tone: "cyan",
            sortOrder: store.services.length,
            isActive: true,
          })
          store.setServices((current) => [...current, service])
          store.setGames((current) => [...current, name])
        }}
        onDeleteGame={async (name) => {
          const service = store.services.find((item) => item.name === name || item.game === name)
          if (service) {
            await api.admin.deleteService(service.id)
            store.setServices((current) => current.filter((item) => item.id !== service.id))
            store.setServicePackages((current) => current.filter((item) => item.serviceId !== service.id))
            store.setProducts((current) => current.filter((item) => item.game !== name))
          }
          store.setGames((current) => current.filter((item) => item !== name))
        }}
        middlemanInfo={store.middlemanInfo}
        onUpdateMiddleman={async (info) => {
          await api.admin.updateSetting("middlemanInfo", info as unknown as Record<string, unknown>)
          store.setMiddlemanInfo(info)
        }}
        contactInfo={store.contactInfo}
        onUpdateContact={async (info) => {
          await api.admin.updateSetting("contactInfo", info as unknown as Record<string, unknown>)
          store.setContactInfo(info)
        }}
        users={store.users}
        transactions={store.transactions}
        onUpdateUser={async (id, updates) => {
          const { api } = await import("@/services/api")
          const updated = await api.admin.updateUser(id, updates)
          store.setUsers((current) => current.map((item) => item.id === id ? updated : item))
        }}
        onUpdateTransaction={async (id, status) => {
          const { api } = await import("@/services/api")
          const updated = await api.admin.updateTransaction(id, status)
          store.setTransactions((current) => current.map((item) => item.id === id ? updated : item))
        }}
      />
    </div>
  )
}
