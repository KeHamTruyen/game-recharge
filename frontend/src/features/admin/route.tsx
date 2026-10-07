import { useNavigate } from "react-router"
import { useAppStore } from "@/app/AppStore"
import { AdminHeader, AdminLogin, AdminPage } from "@/features/admin"
import { api } from "@/services/api"

export function AdminRoute() {
  const store = useAppStore()
  const navigate = useNavigate()

  if (store.user?.role !== "admin") {
    return (
      <div className="app-shell admin-shell">
        <AdminLogin
          onLogin={async (email, password) => {
            const user = await store.login(email, password, undefined, "admin")
            if (user.role !== "admin") {
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
        adminName={store.user.name}
        adminEmail={store.user.email}
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
            image: product.image || null,
            imagePosition: product.imagePosition || null,
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
            image: updates.image || null,
            imagePosition: updates.imagePosition || null,
            isActive: updates.isActive !== undefined ? updates.isActive : undefined,
          })
          store.setServicePackages((current) => current.map((item) => item.id === id ? updated : item))
          store.setProducts((current) => current.map((item) => item.id === id ? { ...item, ...updates, isActive: updated.isActive } : item))
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
          try {
            await api.admin.deleteTemplate(id)
            store.setTopupTemplates((current) =>
              current.filter((item) => item.id !== id),
            )
            store.setProducts((current) =>
              current.map((item) =>
                item.templateId === id ? { ...item, templateId: "" } : item,
              ),
            )
            store.setServicePackages((current) =>
              current.map((item) =>
                item.templateId === id ? { ...item, templateId: "" } : item,
              ),
            )
            store.setNotice("Đã xóa mẫu thông tin nạp thành công.")
          } catch (error) {
            store.setNotice(error instanceof Error ? error.message : "Xóa mẫu thông tin thất bại.")
          }
        }}
        onAddCategory={async (name) => {
          if (store.categories.includes(name)) return
          try {
            await api.admin.createTag(name)
            store.setCategories((current) => [...current, name])
            store.setNotice(`Đã thêm tag "${name}" thành công.`)
          } catch (error) {
            store.setNotice(error instanceof Error ? error.message : "Thêm tag thất bại.")
          }
        }}
        onUpdateCategory={async (oldName, newName) => {
          try {
            const tags = await api.admin.tags()
            const tag = tags.find((item) => item.name === oldName)
            if (tag) {
              await api.admin.updateTag(tag.id, newName)
            }
            store.setCategories((current) =>
              current.map((item) => (item === oldName ? newName : item))
            )
            store.setServicePackages((current) =>
              current.map((item) => ({
                ...item,
                tags: item.tags.map((t) => (t === oldName ? newName : t)),
              }))
            )
            store.setProducts((current) =>
              current.map((item) => ({
                ...item,
                tags: item.tags.map((t) => (t === oldName ? newName : t)),
              }))
            )
            store.setNotice(`Đã đổi tên tag thành "${newName}".`)
          } catch (error) {
            store.setNotice(error instanceof Error ? error.message : "Cập nhật tag thất bại.")
          }
        }}
        onDeleteCategory={async (name) => {
          try {
            const tags = await api.admin.tags()
            const tag = tags.find((item) => item.name === name)
            if (tag) {
              await api.admin.deleteTag(tag.id)
            }
            store.setCategories((current) => current.filter((item) => item === "Tất cả" || item !== name))
            store.setServicePackages((current) =>
              current.map((item) => ({
                ...item,
                tags: item.tags.filter((t) => t !== name),
              }))
            )
            store.setProducts((current) =>
              current.map((item) => ({
                ...item,
                tags: item.tags.filter((t) => t !== name),
              }))
            )
            store.setNotice(`Đã xóa tag "${name}" thành công.`)
          } catch (error) {
            store.setNotice(error instanceof Error ? error.message : "Xóa tag thất bại.")
          }
        }}
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
          try {
            if (service) {
              await api.admin.deleteService(service.id)
              store.setServices((current) => current.filter((item) => item.id !== service.id))
              store.setServicePackages((current) => current.filter((item) => item.serviceId !== service.id))
              store.setProducts((current) => current.filter((item) => item.game !== name))
            }
            store.setGames((current) => current.filter((item) => item !== name))
            store.setNotice(`Đã xóa game "${name}" thành công.`)
          } catch (error) {
            store.setNotice(error instanceof Error ? error.message : "Xóa game thất bại.")
          }
        }}
        onUpdateGame={async (name, updates) => {
          const service = store.services.find((item) => item.name === name || item.game === name)
          if (!service) return
          try {
            const updated = await api.admin.updateService(service.id, updates)
            store.setServices((current) => current.map((item) => item.id === service.id ? updated : item))
            store.setGames((current) => current.map((item) => item === name ? (updated.name || item) : item))
            if (updated.name && updated.name !== name) {
              store.setProducts((current) =>
                current.map((item) => item.game === name ? { ...item, game: updated.name } : item)
              )
            }
            store.setNotice(`Đã cập nhật thông tin game "${updated.name || name}" thành công.`)
          } catch (error) {
            store.setNotice(error instanceof Error ? error.message : "Cập nhật game thất bại.")
          }
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
        onUpdateProfile={async (name) => { await store.updateProfile(name) }}
        onChangePassword={store.changePassword}
      />
    </div>
  )
}
