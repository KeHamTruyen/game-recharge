import { createBrowserRouter, Navigate, Outlet } from "react-router"
import { AppStoreProvider } from "@/app/AppStore"
import { PublicLayout } from "@/app/layouts"
import { Seo } from "@/app/Seo"

function AppRoot() {
  return (
    <AppStoreProvider>
      <Seo />
      <Outlet />
    </AppStoreProvider>
  )
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppRoot,
    children: [
      {
        Component: PublicLayout,
        children: [
          { index: true, element: <Navigate to="/nap-game" replace /> },
          {
            path: "nap-game",
            lazy: async () => ({
              Component: (await import("@/features/storefront/routes"))
                .StorefrontRoute,
            }),
          },
          {
            path: "nap-game/:serviceId",
            lazy: async () => ({
              Component: (await import("@/features/storefront/routes"))
                .ServiceDetailRoute,
            }),
          },
          {
            path: "nap-game/thong-tin",
            lazy: async () => ({
              Component: (await import("@/features/storefront/routes"))
                .TopupInformationRoute,
            }),
          },
          {
            path: "thanh-toan",
            lazy: async () => ({
              Component: (await import("@/features/storefront/routes"))
                .CheckoutRoute,
            }),
          },
          {
            path: "trung-gian",
            lazy: async () => ({
              Component: (await import("@/features/content/routes"))
                .MiddlemanRoute,
            }),
          },
          {
            path: "lien-he",
            lazy: async () => ({
              Component: (await import("@/features/content/routes"))
                .ContactRoute,
            }),
          },
          {
            path: "tai-khoan",
            lazy: async () => ({
              Component: (await import("@/features/content/routes"))
                .AccountRoute,
            }),
          },
          {
            path: "wiki/giftcode",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).GiftcodePage,
            }),
          },
          {
            path: "wiki/list",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).AniimoListPage,
            }),
          },
          {
            path: "wiki/so-sanh",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).StatsComparisonPage,
            }),
          },
          {
            path: "wiki/stats",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).StatsComparisonPage,
            }),
          },
          {
            path: "wiki/tier-list",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).TierListPage,
            }),
          },
          {
            path: "wiki/map",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).WorldMapPage,
            }),
          },
          {
            path: "wiki/build",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).TeamBuilderPage,
            }),
          },
          {
            path: "wiki/team",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).RecommendedTeamsPage,
            }),
          },
          {
            path: "wiki/teams",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).RecommendedTeamsPage,
            }),
          },
          {
            path: "wiki/thu-vien",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).LibraryPage,
            }),
          },
          {
            path: "wiki/huong-dan",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).WikiGuidePage,
            }),
          },
          {
            path: "wiki/khac-he",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).TeamBuilderPage,
            }),
          },
          {
            path: "wiki/elements",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).TeamBuilderPage,
            }),
          },
          {
            path: "wiki/damage-matrix",
            lazy: async () => ({
              Component: (await import("@/features/wiki")).TeamBuilderPage,
            }),
          },
        ],
      },
      {
        path: "admin/*",
        lazy: async () => ({
          Component: (await import("@/features/admin/route")).AdminRoute,
        }),
      },
      { path: "*", element: <Navigate to="/nap-game" replace /> },
    ],
  },
])
