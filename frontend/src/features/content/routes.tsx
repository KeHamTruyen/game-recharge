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
  if (!store.user) return <Navigate to="/nap-game" replace />
  return (
    <AccountPage
      email={store.user.email}
      transactions={store.transactions.filter(
        (item) => item.email === store.user?.email,
      )}
      onLogout={() => {
        store.logout()
        navigate("/nap-game")
      }}
      onUpdateProfile={async (name) => { await store.updateProfile(name) }}
      onChangePassword={store.changePassword}
    />
  )
}
