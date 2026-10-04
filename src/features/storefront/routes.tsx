import { useState } from "react"
import { Navigate, useNavigate } from "react-router"
import { useAppStore } from "@/app/AppStore"
import {
  CheckoutPage,
  ServiceDetailPage,
  TopupInformationPage,
  TopupPage,
} from "@/features/storefront/pages"
import type { Service, ServicePackage } from "@/domain/models"

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
      servicePackages={store.servicePackages}
      productStatuses={store.productStatuses}
      onSelectService={(service: Service) => {
        store.setSelectedService(service)
        store.setSelectedPackage(null)
        store.setSelectedQuantity(1)
        store.setCheckoutInfo({})
        navigate(`/nap-game/${service.id}`)
      }}
    />
  )
}

// ─── Trang chi tiết dịch vụ ─────────────────────────────────────────────────

export function ServiceDetailRoute() {
  const store = useAppStore()
  const navigate = useNavigate()

  const service = store.selectedService
  if (!service) return <Navigate to="/nap-game" replace />

  const packages = store.servicePackages.filter(
    (p) => p.serviceId === service.id,
  )

  return (
    <ServiceDetailPage
      service={service}
      packages={packages}
      productStatuses={store.productStatuses}
      onBack={() => navigate("/nap-game")}
      onSelectPackage={(pkg: ServicePackage) => {
        store.setSelectedPackage(pkg)
        store.setSelectedQuantity(1)
        store.setCheckoutInfo({})
        navigate("/nap-game/thong-tin")
      }}
    />
  )
}

// ─── Trang nhập thông tin nạp ────────────────────────────────────────────────

export function TopupInformationRoute() {
  const store = useAppStore()
  const navigate = useNavigate()

  const pkg = store.selectedPackage
  const service = store.selectedService
  if (!pkg || !service) return <Navigate to="/nap-game" replace />

  return (
    <TopupInformationPage
      pkg={pkg}
      service={service}
      template={store.topupTemplates.find(
        (item) => item.id === pkg.templateId,
      )}
      quantity={store.selectedQuantity}
      onQuantityChange={store.setSelectedQuantity}
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

  const pkg = store.selectedPackage
  const service = store.selectedService
  if (!pkg || !service) return <Navigate to="/nap-game" replace />

  const template = store.topupTemplates.find(
    (item) => item.id === pkg.templateId,
  )

  return (
    <CheckoutPage
      pkg={pkg}
      service={service}
      template={template}
      quantity={store.selectedQuantity}
      topupInfo={store.checkoutInfo}
      onBack={() => navigate("/nap-game/thong-tin")}
      onNotice={store.setNotice}
      onConfirm={() => {
        const id = Date.now()
        const email =
          store.user?.email ||
          store.checkoutInfo.contactEmail ||
          "guest@nexa.local"
        store.setTransactions((current) => [
          {
            id,
            code: `NEXA${String(id).slice(-6)}`,
            email,
            product: pkg.name,
            game: service.name,
            amount: pkg.price * store.selectedQuantity,
            quantity: store.selectedQuantity,
            status: "Đang xử lý",
            date: new Date().toLocaleString("vi-VN"),
            topupInfo: store.checkoutInfo,
            topupLabels: Object.fromEntries(
              (template?.fields || []).map((field) => [field.key, field.label]),
            ),
            templateName: template?.name,
          },
          ...current,
        ])
        store.setNotice(
          "Đơn hàng đã được ghi nhận và chuyển sang trạng thái đang xử lý.",
        )
      }}
    />
  )
}
