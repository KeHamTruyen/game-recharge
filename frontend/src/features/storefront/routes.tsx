import { useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router"
import { useAppStore } from "@/app/AppStore"
import {
  CheckoutPage,
  ServiceDetailPage,
  TopupInformationPage,
  TopupPage,
} from "@/features/storefront/pages"
import type { Service, ServicePackage } from "@/domain/models"
import { api } from "@/services/api"

// ─── Trang chủ: Danh sách dịch vụ ───────────────────────────────────────────

export function StorefrontRoute() {
  const store = useAppStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")

  return (
    <TopupPage
      services={store.services}
      search={search}
      onSearch={setSearch}
      onSelectService={(service: Service) => {
        store.setSelectedService(service)
        store.setSelectedPackage(null)
        store.setSelectedQuantity(1)
        store.setCheckoutInfo({})
        store.setCart([])
        navigate(`/nap-game/${service.id}`)
      }}
    />
  )
}

// ─── Trang chi tiết dịch vụ ─────────────────────────────────────────────────

export function ServiceDetailRoute() {
  const store = useAppStore()
  const navigate = useNavigate()
  const { serviceId } = useParams()

  const service = store.selectedService || store.services.find((item) => String(item.id) === serviceId)
  if (!service) {
    if (!store.apiReady) return <div className="page-width empty-state">Đang tải dịch vụ...</div>
    return <Navigate to="/nap-game" replace />
  }

  const packages = store.servicePackages.filter(
    (p) => p.serviceId === service.id,
  )

  return (
    <ServiceDetailPage
      service={service}
      packages={packages}
      productStatuses={store.productStatuses}
      onBack={() => navigate("/nap-game")}
      onAddToCart={(pkg: ServicePackage) => {
        store.setCart((current) => {
          const existing = current.find((item) => item.pkg.id === pkg.id)
          return existing
            ? current.map((item) => item.pkg.id === pkg.id ? { ...item, quantity: Math.min(10, item.quantity + 1) } : item)
            : [...current, { pkg, quantity: 1 }]
        })
        store.setSelectedService(service)
        store.setNotice(`${pkg.name} đã được thêm vào giỏ hàng.`)
      }}
      cartCount={store.cart.reduce((total, item) => total + item.quantity, 0)}
      onOpenCart={() => {
        const first = store.cart[0]
        if (first) {
          store.setSelectedPackage(first.pkg)
          store.setSelectedQuantity(first.quantity)
          navigate("/nap-game/thong-tin")
        }
      }}
    />
  )
}

// ─── Trang nhập thông tin nạp ────────────────────────────────────────────────

export function TopupInformationRoute() {
  const store = useAppStore()
  const navigate = useNavigate()

  const pkg = store.selectedPackage || store.cart[0]?.pkg
  const service = store.selectedService
  if (!pkg || !service || store.cart.length === 0) return <Navigate to="/nap-game" replace />

  return (
    <TopupInformationPage
      pkg={pkg}
      service={service}
      cart={store.cart}
      packages={store.servicePackages.filter((item) => item.serviceId === service.id)}
      productStatuses={store.productStatuses}
      template={store.topupTemplates.find(
        (item) => item.id === pkg.templateId,
      )}
      quantity={store.selectedQuantity}
      onQuantityChange={store.setSelectedQuantity}
      onPackageChange={(nextPackage) => {
        store.setSelectedPackage(nextPackage)
        store.setCart((current) => current.some((item) => item.pkg.id === nextPackage.id)
          ? current
          : [...current, { pkg: nextPackage, quantity: 1 }])
        store.setSelectedQuantity(store.cart.find((item) => item.pkg.id === nextPackage.id)?.quantity || 1)
      }}
      onQuantityChangeForPackage={(id, quantity) => {
        const nextQuantity = Math.max(0, Math.min(10, quantity))
        store.setCart((current) => nextQuantity === 0
          ? current.filter((item) => item.pkg.id !== id)
          : current.map((item) => item.pkg.id === id ? { ...item, quantity: nextQuantity } : item))
        if (String(store.selectedPackage?.id) === String(id)) store.setSelectedQuantity(nextQuantity)
      }}
      onRemoveFromCart={(id) => store.setCart((current) => current.filter((item) => item.pkg.id !== id))}
      onBack={() => navigate(`/nap-game/${service.id}`)}
      onContinue={(values) => {
        store.setCheckoutInfo(values)
        navigate("/thanh-toan")
      }}
    />
  )
}

// ─── Trang thanh toán ────────────────────────────────────────────────────────

export function CheckoutRoute() {
  const store = useAppStore()
  const navigate = useNavigate()

  const pkg = store.selectedPackage || store.cart[0]?.pkg
  const service = store.selectedService
  if (!pkg || !service || store.cart.length === 0) return <Navigate to="/nap-game" replace />

  const template = store.topupTemplates.find(
    (item) => item.id === pkg.templateId,
  )

  return (
    <CheckoutPage
      pkg={pkg}
      service={service}
      template={template}
      quantity={store.selectedQuantity}
      cart={store.cart}
      topupInfo={store.checkoutInfo}
      onBack={() => navigate("/nap-game/thong-tin")}
      onNotice={store.setNotice}
      onConfirm={async () => {
        try {
          const transactions = await Promise.all(store.cart.map((item) =>
            api.orders.create(item.pkg.id, item.quantity, store.checkoutInfo, store.user?.email),
          ))
          store.setTransactions((current) => [...transactions, ...current])
          store.setNotice("Đơn hàng đã được ghi nhận và chuyển sang trạng thái chờ thanh toán.")
          return true
        } catch (error) {
          store.setNotice(error instanceof Error ? error.message : "Không thể tạo đơn hàng.")
          return false
        }
      }}
    />
  )
}
