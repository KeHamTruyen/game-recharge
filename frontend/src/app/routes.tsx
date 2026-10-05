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
