import { useNavigate } from "react-router"
import { useAppStore } from "@/app/AppStore"
import { AdminHeader, AdminLogin, AdminPage } from "@/features/admin"

export function AdminRoute() {
  const store = useAppStore()
  const navigate = useNavigate()

  if (store.user?.role !== "admin") {
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
        categories={store.categories}
        games={store.games}
        productStatuses={store.productStatuses}
        topupTemplates={store.topupTemplates}
        onAddProduct={(product) =>
          store.setProducts((current) => [
            { ...product, id: Date.now() },
            ...current,
          ])
        }
        onDeleteProduct={(id) =>
          store.setProducts((current) =>
            current.filter((item) => item.id !== id),
          )
        }
        onUpdateProduct={(id, updates) =>
          store.setProducts((current) =>
            current.map((item) =>
              item.id === id ? { ...item, ...updates } : item,
            ),
          )
        }
        onAddProductStatus={(status) =>
          store.setProductStatuses((current) => [...current, status])
        }
        onDeleteProductStatus={(id) => {
          store.setProductStatuses((current) =>
            current.filter((item) => item.id !== id),
          )
          store.setProducts((current) =>
            current.map((item) =>
              item.statusId === id ? { ...item, statusId: "available" } : item,
            ),
          )
        }}
        onAddTopupTemplate={(template) =>
          store.setTopupTemplates((current) => [...current, template])
        }
        onUpdateTopupTemplate={(id, template) =>
          store.setTopupTemplates((current) =>
            current.map((item) => (item.id === id ? template : item)),
          )
        }
        onDeleteTopupTemplate={(id) => {
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
        onAddGame={(name) =>
          store.setGames((current) =>
            current.includes(name) ? current : [...current, name],
          )
        }
        onDeleteGame={(name) =>
          store.setGames((current) => current.filter((item) => item !== name))
        }
        middlemanInfo={store.middlemanInfo}
        onUpdateMiddleman={store.setMiddlemanInfo}
        contactInfo={store.contactInfo}
        onUpdateContact={store.setContactInfo}
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
