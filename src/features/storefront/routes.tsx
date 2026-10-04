import { useMemo, useState } from "react"
import { Navigate, useNavigate, useSearchParams } from "react-router"
import { useAppStore } from "@/app/AppStore"
import {
  CheckoutPage,
  TopupInformationPage,
  TopupPage,
} from "@/features/storefront/pages"

export function StorefrontRoute() {
  const store = useAppStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [category, setCategory] = useState("Tất cả")
  const [search, setSearch] = useState("")
  const selectedGame = searchParams.get("game") || ""
  const products = useMemo(
    () =>
      store.products.filter((product) => {
        const matchesCategory =
          category === "Tất cả" || product.tags.includes(category)
        const matchesGame = !selectedGame || product.game === selectedGame
        const query = search.trim().toLowerCase()
        return (
          matchesCategory &&
          matchesGame &&
          (!query ||
            `${product.name} ${product.game}`.toLowerCase().includes(query))
        )
      }),
    [store.products, category, search, selectedGame],
  )

  return (
    <TopupPage
      products={products}
      categories={store.categories}
      category={category}
      search={search}
      onCategory={setCategory}
      onSearch={setSearch}
      productStatuses={store.productStatuses}
      selectedGame={selectedGame}
      onClearGame={() => setSearchParams({})}
      onBuy={(product) => {
        store.setSelectedProduct(product)
        store.setSelectedQuantity(1)
        store.setCheckoutInfo({})
        navigate("/nap-game/thong-tin")
      }}
    />
  )
}

export function TopupInformationRoute() {
  const store = useAppStore()
  const navigate = useNavigate()
  if (!store.selectedProduct) return <Navigate to="/nap-game" replace />
  return (
    <TopupInformationPage
      product={store.selectedProduct}
      template={store.topupTemplates.find(
        (item) => item.id === store.selectedProduct?.templateId,
      )}
      quantity={store.selectedQuantity}
      onQuantityChange={store.setSelectedQuantity}
      onBack={() => navigate("/nap-game")}
      onContinue={(values) => {
        store.setCheckoutInfo(values)
        navigate("/thanh-toan")
      }}
    />
  )
}

export function CheckoutRoute() {
  const store = useAppStore()
  const navigate = useNavigate()
  const product = store.selectedProduct
  if (!product) return <Navigate to="/nap-game" replace />
  const template = store.topupTemplates.find(
    (item) => item.id === product.templateId,
  )
  return (
    <CheckoutPage
      product={product}
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
            product: product.name,
            game: product.game,
            amount: product.price * store.selectedQuantity,
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
