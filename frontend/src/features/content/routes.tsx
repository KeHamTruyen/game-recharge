import { Navigate, useNavigate } from "react-router"
import { useAppStore } from "@/app/AppStore"
import {
  AccountPage,
  ContactPage,
  MiddlemanPage,
} from "@/features/content/pages"

export function MiddlemanRoute() {
  const store = useAppStore()
  return <MiddlemanPage info={store.middlemanInfo} />
}

export function ContactRoute() {
  const store = useAppStore()
  return <ContactPage info={store.contactInfo} />
}

export function AccountRoute() {
  const store = useAppStore()
  const navigate = useNavigate()
  if (!store.apiReady && !store.user) return <p className="page-width" role="status">Đang tải tài khoản…</p>
  if (!store.user) return <Navigate to="/nap-game" replace />
  if (store.user.role === "admin") return <Navigate to="/admin" replace />
  return (
    <AccountPage
      email={store.user.email}
      displayName={store.user.name}
      onRefresh={store.refreshTransactions}
      transactions={(store.transactions || []).filter(
        (item) => !item.email || item.email.toLowerCase() === store.user?.email.toLowerCase(),
      )}
      onLogout={() => {
        void store.logout().then(() => navigate("/nap-game")).catch((error) =>
          store.setNotice(error instanceof Error ? error.message : "Không thể đăng xuất. Vui lòng thử lại."))
      }}
      onUpdateProfile={async (name) => { await store.updateProfile(name) }}
      onChangePassword={store.changePassword}
    />
  )
}
