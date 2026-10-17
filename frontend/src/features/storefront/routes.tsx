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
      packages={store.servicePackages}
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
      packages={store.servicePackages}
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
  const cartSignature = store.cart.map((i) => `${i.pkg.id}:${i.quantity}`).sort((a, b) => a.localeCompare(b)).join(",")
  const cartTotalAmount = store.cart.reduce((sum, i) => sum + i.pkg.price * i.quantity, 0)

  const [payment, setPayment] = useState<PaymentDetails | null>(() => {
    try {
      const saved = sessionStorage.getItem("duke1305_checkout_payment")
      if (!saved) return null
      const parsed = JSON.parse(saved)
      const data = parsed.payment || parsed
      if (!data || !data.orderCode) return null

      if (store.user && parsed.userEmail && store.user.email !== parsed.userEmail) {
        sessionStorage.removeItem("duke1305_checkout_payment")
        return null
      }
      if (cartSignature && parsed.cartSignature && cartSignature !== parsed.cartSignature) {
        sessionStorage.removeItem("duke1305_checkout_payment")
        return null
      }
      if (cartTotalAmount > 0 && parsed.totalAmount && cartTotalAmount !== parsed.totalAmount) {
        sessionStorage.removeItem("duke1305_checkout_payment")
        return null
      }
      return data
    } catch {
      return null
    }
  })
  const [paymentStatus, setPaymentStatus] = useState<"PENDING" | "PAID">("PENDING")
  const [orderStatus, setOrderStatus] = useState<string>("PENDING")
  const [paymentError, setPaymentError] = useState("")
  const [recoveryChecked, setRecoveryChecked] = useState(false)
  const [recoveryError, setRecoveryError] = useState("")
  const [recoveryRetry, setRecoveryRetry] = useState(0)
  const { setNotice } = store

  useEffect(() => {
    if (!store.apiReady) return
    let cancelled = false
    const recover = async () => {
      try {
        const saved = sessionStorage.getItem("duke1305_checkout_attempt")
        const attempt = saved ? JSON.parse(saved) : null
        if (!payment && store.user && attempt?.userEmail === store.user.email &&
            attempt.cartSignature === cartSignature && attempt.totalAmount === cartTotalAmount) {
          const restored = await api.orders.recoverCheckout(attempt.key)
          if (cancelled) return
          if (restored) {
            sessionStorage.setItem("duke1305_checkout_payment", JSON.stringify({
              payment: restored, userEmail: store.user.email, cartSignature, totalAmount: cartTotalAmount,
            }))
            setPayment(restored)
          }
        }
        if (!cancelled) setRecoveryChecked(true)
      } catch {
        if (!cancelled) setRecoveryError("Chưa kiểm tra được đơn trước đó. Vui lòng thử lại để tránh tạo đơn trùng.")
      }
    }
    void recover()
    return () => { cancelled = true }
  }, [store.apiReady, store.user?.email, cartSignature, cartTotalAmount, recoveryRetry])

  useEffect(() => {
    if (payment) {
      const stored = sessionStorage.getItem("duke1305_checkout_payment")
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (
            (store.user && parsed.userEmail && store.user.email !== parsed.userEmail) ||
            (cartSignature && parsed.cartSignature && cartSignature !== parsed.cartSignature) ||
            (cartTotalAmount > 0 && parsed.totalAmount && cartTotalAmount !== parsed.totalAmount)
          ) {
            setPayment(null)
            sessionStorage.removeItem("duke1305_checkout_payment")
          }
        } catch { setPayment(null) }
      } else {
        setPayment(null)
      }
    }
  }, [store.user?.email, cartSignature, cartTotalAmount, store.checkoutInfo, payment])

  useEffect(() => {
    if (!payment || paymentStatus === "PAID" || paymentError) return
    let cancelled = false
    const checkStatus = async () => {
      try {
        const result = await api.payments.status(payment.orderCode)
        if (cancelled) return
        if (!cancelled && result.paymentStatus === "PAID") {
          setPaymentStatus("PAID")
          setOrderStatus(result.status)
          sessionStorage.removeItem("duke1305_checkout_payment")
          sessionStorage.removeItem("duke1305_checkout_key")
          sessionStorage.removeItem("duke1305_checkout_key_sig")
          sessionStorage.removeItem("duke1305_checkout_attempt")
          store.setCart([])
          if (result.status === "FAILED") {
            setNotice("Đã nhận tiền, đơn đã hủy — liên hệ CSKH")
          } else {
            setNotice("Đã nhận thanh toán. Đơn hàng đang được xử lý.")
          }
        } else if (["EXPIRED", "FAILED", "REFUNDED"].includes(result.paymentStatus) ||
          ["FAILED", "REFUNDED"].includes(result.status)) {
          setPaymentError("Đơn đã hủy, hết hạn hoặc hoàn tiền. Vui lòng không chuyển khoản vào mã này; liên hệ CSKH nếu đã chuyển tiền.")
          sessionStorage.removeItem("duke1305_checkout_payment")
          sessionStorage.removeItem("duke1305_checkout_attempt")
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
  }, [payment, paymentStatus, paymentError, setNotice])

  if (paymentError) return <div className="page-width empty-state" role="alert">
    <p>{paymentError}</p>
    <button className="secondary-button" onClick={() => navigate("/nap-game")}>Quay lại chọn gói</button>
  </div>

  if (recoveryError) return <div className="page-width empty-state" role="alert">
    <p>{recoveryError}</p>
    <button className="secondary-button" onClick={() => {
      setRecoveryError("")
      setRecoveryRetry((value) => value + 1)
    }}>Thử lại</button>
  </div>

  if (!store.apiReady || !recoveryChecked) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        <span className="text-sm">Đang tải thông tin phiên đăng nhập...</span>
      </div>
    )
  }

  if (!pkg || !service) return <Navigate to="/nap-game" replace />
  const template = store.topupTemplates.find((item) => item.id === pkg.templateId)
  if (!store.user || (!payment && template?.fields.some((field) =>
    field.required && !store.checkoutInfo[field.key]?.trim()))) {
    return <Navigate to="/nap-game/thong-tin" replace />
  }

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
      orderStatus={orderStatus}
      isMaintenance={Boolean(store.siteConfig?.maintenanceMode)}
      onBack={() => navigate("/nap-game/thong-tin")}
      onNotice={store.setNotice}
      onConfirm={async () => {
        try {
        if (store.siteConfig?.maintenanceMode) {
          store.setNotice(
            store.siteConfig.maintenanceMessage ||
              "Hệ thống đang bảo trì, tạm thời không thể tạo đơn hàng mới.",
          )
          return false
        }
        if (!store.user) {
          store.setNotice("Vui lòng đăng nhập trước khi thanh toán.")
          openLogin()
          return false
        }
        const savedAttempt = sessionStorage.getItem("duke1305_checkout_attempt")
        const previous = savedAttempt ? JSON.parse(savedAttempt) : null
        const checkoutKey = previous?.userEmail === store.user.email &&
          previous.cartSignature === cartSignature && previous.totalAmount === cartTotalAmount
          ? previous.key : crypto.randomUUID()
        // Persist only an opaque request ID and public cart metadata before sending.
        sessionStorage.setItem("duke1305_checkout_attempt", JSON.stringify({
          key: checkoutKey, userEmail: store.user.email, cartSignature, totalAmount: cartTotalAmount,
        }))
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
        try {
          sessionStorage.setItem("duke1305_checkout_payment", JSON.stringify({
            payment: result.payment,
            userEmail: store.user.email,
            cartSignature,
            totalAmount: cartTotalAmount,
          }))
        } catch {}
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
