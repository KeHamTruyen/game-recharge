import { useEffect, useState } from "react"
import { Navigate, useNavigate, useOutletContext, useParams } from "react-router"
import type { PublicLayoutContext } from "@/app/layouts"
import { useAppStore } from "@/app/AppStore"
import {
  CheckoutPage,
  ServiceDetailPage,
  TopupInformationPage,
  TopupPage,
} from "@/features/storefront/pages"
import type { Service, ServicePackage } from "@/domain/models"
import { api } from "@/services/api"
import type { PaymentDetails } from "@/services/api"

function CatalogStatus({ error }: { error: string }) {
  return <div className="page-width empty-state" role={error ? "alert" : "status"}>
    {error || "Đang tải dịch vụ…"}
    {error && <button className="secondary-button" onClick={() => window.location.reload()}>Thử lại</button>}
  </div>
}

// ─── Trang chủ: Danh sách dịch vụ ───────────────────────────────────────────

export function StorefrontRoute() {
  const store = useAppStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  if (!store.apiReady || store.apiError) return <CatalogStatus error={store.apiError} />

  const topupServices = store.services.filter((s) => s.category !== "boosting")

  return (
    <TopupPage
      services={topupServices}
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

// ─── Trang chủ: Cày thuê ─────────────────────────────────────────────────────

export function BoostingRoute() {
  const store = useAppStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  if (!store.apiReady || store.apiError) return <CatalogStatus error={store.apiError} />

  const boostingServices = store.services.filter((s) => s.category === "boosting")

  return (
    <TopupPage
      services={boostingServices}
      search={search}
      onSearch={setSearch}
      mode="boosting"
      onSelectService={(service: Service) => {
        store.setSelectedService(service)
        store.setSelectedPackage(null)
        store.setSelectedQuantity(1)
        store.setCheckoutInfo({})
        store.setCart([])
        navigate(`/cay-thue/${service.id}`)
      }}
    />
  )
}

// ─── Chi tiết cày thuê ───────────────────────────────────────────────────────

export function BoostingDetailRoute() {
  const store = useAppStore()
  const navigate = useNavigate()
  const { serviceId } = useParams()
  if (!store.apiReady || store.apiError) return <CatalogStatus error={store.apiError} />

  const service = store.services.find(
      (item) => String(item.id) === serviceId && item.category === "boosting",
    )

  if (!service) {
    if (!store.apiReady)
      return <div className="page-width empty-state">Đang tải dịch vụ cày thuê...</div>
    return <Navigate to="/cay-thue" replace />
  }

  const packages = store.servicePackages.filter(
    (p) => String(p.serviceId) === String(service.id),
  )

  return (
    <ServiceDetailPage
      service={service}
      packages={packages}
      productStatuses={store.productStatuses}
      onBack={() => navigate("/cay-thue")}
      onAddToCart={(pkg: ServicePackage) => {
        const firstItem = store.cart[0]
        if (
          firstItem &&
          (String(firstItem.pkg.serviceId) !== String(pkg.serviceId) ||
            firstItem.pkg.templateId !== pkg.templateId)
        ) {
          store.setNotice(
            "Bạn chỉ có thể mua các gói cùng game và cùng mẫu thông tin trong một lần.",
          )
          return
        }
        store.setCart((current) => {
          const isSelected = current.some(
            (item) => String(item.pkg.id) === String(pkg.id),
          )
          if (isSelected) {
            return current.filter(
              (item) => String(item.pkg.id) !== String(pkg.id),
            )
          }
          return [...current, { pkg, quantity: 1 }]
        })
        store.setSelectedService(service)
      }}
      cartCount={store.cart.reduce((total, item) => total + item.quantity, 0)}
      cartTotal={store.cart.reduce(
        (total, item) => total + item.pkg.price * item.quantity,
        0,
      )}
      selectedPackageIds={
        new Set(store.cart.map((item) => String(item.pkg.id)))
      }
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

// ─── Trang chi tiết dịch vụ ─────────────────────────────────────────────────

export function ServiceDetailRoute() {
  const store = useAppStore()
  const navigate = useNavigate()
  const { serviceId } = useParams()
  if (!store.apiReady || store.apiError) return <CatalogStatus error={store.apiError} />

  const service = store.services.find((item) => String(item.id) === serviceId && item.category !== "boosting")
  if (!service) {
    if (!store.apiReady) return <div className="page-width empty-state">Đang tải dịch vụ...</div>
    return <Navigate to="/nap-game" replace />
  }

  const packages = store.servicePackages.filter(
    (p) => String(p.serviceId) === String(service.id),
  )

  return (
    <ServiceDetailPage
      service={service}
      packages={packages}
      productStatuses={store.productStatuses}
      onBack={() => navigate("/nap-game")}
      onAddToCart={(pkg: ServicePackage) => {
        const firstItem = store.cart[0]
        if (
          firstItem &&
          (String(firstItem.pkg.serviceId) !== String(pkg.serviceId) || firstItem.pkg.templateId !== pkg.templateId)
        ) {
          store.setNotice("Bạn chỉ có thể mua các gói cùng game và cùng mẫu thông tin trong một lần.")
          return
        }
        store.setCart((current) => {
          const isSelected = current.some((item) => String(item.pkg.id) === String(pkg.id))
          if (isSelected) {
            return current.filter((item) => String(item.pkg.id) !== String(pkg.id))
          }
          return [...current, { pkg, quantity: 1 }]
        })
        store.setSelectedService(service)
      }}
      cartCount={store.cart.reduce((total, item) => total + item.quantity, 0)}
      cartTotal={store.cart.reduce((total, item) => total + item.pkg.price * item.quantity, 0)}
      selectedPackageIds={new Set(store.cart.map((item) => String(item.pkg.id)))}
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
  const { openLogin } = useOutletContext<PublicLayoutContext>()

  const pkg = store.cart[0]?.pkg
  const service = store.selectedService
  if (!pkg || !service || store.cart.length === 0) return <Navigate to="/nap-game" replace />

  return (
    <TopupInformationPage
      pkg={pkg}
      service={service}
      cart={store.cart}
      template={store.topupTemplates.find(
        (item) => item.id === pkg.templateId,
      )}
      quantity={store.selectedQuantity}
      isLoggedIn={Boolean(store.user)}
      onRequireLogin={() => {
        store.setNotice("Vui lòng đăng nhập trước khi tiếp tục thanh toán.")
        openLogin()
      }}
      onQuantityChange={store.setSelectedQuantity}
      onQuantityChangeForPackage={(id, quantity) => {
        const nextQuantity = Math.max(0, Math.min(10, quantity))
        store.setCart((current) => nextQuantity === 0
          ? current.filter((item) => item.pkg.id !== id)
          : current.map((item) => item.pkg.id === id ? { ...item, quantity: nextQuantity } : item))
        if (String(store.selectedPackage?.id) === String(id)) store.setSelectedQuantity(nextQuantity)
      }}
      onRemoveFromCart={(id) => store.setCart((current) => current.filter((item) => item.pkg.id !== id))}
      onBack={() => navigate(`/${service.category === "boosting" ? "cay-thue" : "nap-game"}/${service.id}`)}
      onContinue={(values) => {
        store.setCheckoutInfo(values)
        if (!store.user) {
          store.setNotice("Vui lòng đăng nhập trước khi tiếp tục thanh toán.")
          openLogin()
          return
        }
        navigate("/thanh-toan")
      }}
    />
  )
}

// ─── Trang thanh toán ────────────────────────────────────────────────────────

export function CheckoutRoute() {
  const store = useAppStore()
  const navigate = useNavigate()
  const { openLogin } = useOutletContext<PublicLayoutContext>()

  const pkg = store.cart[0]?.pkg
  const service = store.selectedService
  const [payment, setPayment] = useState<PaymentDetails | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<"PENDING" | "PAID">("PENDING")
  const [checkoutKey] = useState(() => crypto.randomUUID())
  const { setNotice } = store

  useEffect(() => {
    if (!payment || paymentStatus === "PAID") return
    let cancelled = false
    const checkStatus = async () => {
      try {
        const result = await api.payments.status(payment.orderCode)
        if (!cancelled && result.paymentStatus === "PAID") {
          setPaymentStatus("PAID")
          setNotice("Đã nhận thanh toán. Đơn hàng đang được xử lý.")
        }
      } catch {
        // The payment page remains usable while a temporary status request fails.
      }
    }
    void checkStatus()
    const timer = window.setInterval(() => void checkStatus(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [payment, paymentStatus, setNotice])

  if (!pkg || !service) return <Navigate to="/nap-game" replace />
  if (!store.user) return <Navigate to="/nap-game/thong-tin" replace />
  const template = store.topupTemplates.find((item) => item.id === pkg.templateId)

  return (
    <CheckoutPage
      pkg={pkg}
      service={service}
      template={template}
      quantity={store.selectedQuantity}
      cart={store.cart}
      topupInfo={store.checkoutInfo}
      payment={payment}
      paymentStatus={paymentStatus}
      onBack={() => navigate("/nap-game/thong-tin")}
      onNotice={store.setNotice}
      onConfirm={async () => {
        try {
        if (!store.user) {
          store.setNotice("Vui lòng đăng nhập trước khi thanh toán.")
          openLogin()
          return false
        }
        const result = await api.orders.checkout(
          store.cart.map((item) => ({
            packageId: item.pkg.id,
            quantity: item.quantity,
          })),
          store.checkoutInfo,
          store.user.email,
          checkoutKey,
        )
        setPayment(result.payment)
        store.setTransactions((current) => [...result.transactions, ...current])
        store.setNotice("Đơn hàng đã được ghi nhận và chuyển sang trạng thái chờ thanh toán.")
        return result.payment
        } catch (error) {
          store.setNotice(error instanceof Error ? error.message : "Không thể tạo đơn hàng.")
          return false
        }
      }}
    />
  )
}
