import { createBrowserRouter, Navigate, Outlet } from "react-router"
import { AppStoreProvider } from "@/app/AppStore"
import { PublicLayout } from "@/app/layouts"
import { Seo } from "@/app/Seo"
import NotFoundPage from "@/app/NotFoundPage"

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
            path: "cay-thue",
            lazy: async () => ({
              Component: (await import("@/features/storefront/routes"))
                .BoostingRoute,
            }),
          },
          {
            path: "cay-thue/:serviceId",
            lazy: async () => ({
              Component: (await import("@/features/storefront/routes"))
                .BoostingDetailRoute,
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
            path: "wiki",
            lazy: async () => ({
              Component: (await import("@/features/wiki/WikiLayout")).default,
            }),
            children: [
              { index: true, element: <Navigate to="build" replace /> },
              {
                path: "giftcode",
                lazy: async () => ({
                  Component: (await import("@/features/wiki/GiftcodePage")).default,
                }),
              },
              {
                path: "list",
                lazy: async () => ({
                  Component: (await import("@/features/wiki/AniimoListPage")).default,
                }),
              },
              {
                path: "so-sanh",
                lazy: async () => ({
                  Component: (await import("@/features/wiki/StatsComparisonPage")).default,
                }),
              },
              {
                path: "stats",
                element: <Navigate to="/wiki/so-sanh" replace />,
              },
              {
                path: "tier-list",
                lazy: async () => ({
                  Component: (await import("@/features/wiki/TierListPage")).default,
                }),
              },
              {
                path: "map",
                lazy: async () => ({
                  Component: (await import("@/features/wiki/WorldMapPage")).default,
                }),
              },
              {
                path: "build",
                lazy: async () => ({
                  Component: (await import("@/features/wiki/TeamBuilderPage")).default,
                }),
              },
              {
                path: "team",
                lazy: async () => ({
                  Component: (await import("@/features/wiki/RecommendedTeamsPage")).default,
                }),
              },
              {
                path: "teams",
                element: <Navigate to="/wiki/team" replace />,
              },
              {
                path: "thu-vien",
                lazy: async () => ({
                  Component: (await import("@/features/wiki/LibraryPage")).default,
                }),
              },
              {
                path: "huong-dan",
                lazy: async () => ({
                  Component: (await import("@/features/wiki/WikiGuidePage")).default,
                }),
              },
              {
                path: "khac-he",
                element: <Navigate to="/wiki/build" replace />,
              },
              {
                path: "elements",
                element: <Navigate to="/wiki/build" replace />,
              },
              {
                path: "damage-matrix",
                element: <Navigate to="/wiki/build" replace />,
              },
            ],
          },
        ],
      },
      {
        path: "admin/*",
        lazy: async () => ({
          Component: (await import("@/features/admin/route")).AdminRoute,
        }),
      },
      { path: "*", Component: NotFoundPage },
    ],
  },
])
