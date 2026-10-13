import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'

import siteConfiguration from '../.figma/make/site.json'


// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // .figma/make/deploy-preview passes `--mode development` for cached-preview builds.
  const emitSourcemaps = mode === 'development'

  return {
    base: process.env.FIGMA_PUBLIC_URL ? `${process.env.FIGMA_PUBLIC_URL}/` : '/',
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },
    plugins: [
react(),
      tailwindcss(),
      figmaSiteConfiguration(siteConfiguration),
      figmaErrorOverlayReplay(),
      figmaReactRefreshBoundaryFallback(),
      figmaMakeKitPlugin({ storiesGlob: '/src/**/*.stories.{ts,tsx,js,jsx}' }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '5173'),
      strictPort: false,
      proxy: {
        '/api': 'http://127.0.0.1:3000',
        '/uploads': 'http://127.0.0.1:3000',
      },
      watch: {
        ignored: [
          '**/.figma/**',
],
      },
    },
    preview: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '5173'),
    },
  }
})

type FigmaSiteConfiguration = {
  title?: string
  description?: string
  language?: string
  robots?: {
    index?: boolean
  }
  icons?: {
    icon?: string
  }
  openGraph?: {
    image?: string
  }
  analytics?: {
    googleAnalyticsId?: string
  }
  customScripts?: {
    headStart?: string
    headEnd?: string
    bodyStart?: string
    bodyEnd?: string
  }
  accessibility?: {
    addBypassLinks?: boolean
  }
}

/** Applies /.figma/make/site.json to the generated document shell. */
function figmaSiteConfiguration(config: FigmaSiteConfiguration): Plugin {
  function sanitizeHtmlValue(value: string | undefined): string {
    return value?.replace(/[^a-zA-Z0-9_-]/g, '') || ''
  }
  function escapeHtmlText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function replaceHtmlCommentSlot(html: string, slotName: string, content: string): string {
    return html.replace(`<!-- ${slotName} -->`, content)
  }

  const title = config.title ?? "Figma Make App"
  const description = config.description ?? ''
  const favicon = config.icons?.icon ?? ''
  const socialImage = config.openGraph?.image ?? ''
  const language = sanitizeHtmlValue(config.language) || 'en'
  const googleAnalyticsId = sanitizeHtmlValue(config.analytics?.googleAnalyticsId)
  const headStart = config.customScripts?.headStart ?? ''
  const headEnd = config.customScripts?.headEnd ?? ''
  const bodyStart = config.customScripts?.bodyStart ?? ''
  const bodyEnd = config.customScripts?.bodyEnd ?? ''
  const siteUrl = (process.env.VITE_SITE_URL || 'https://duke1305.vn').replace(/\/+$/, '')
  const robotsTxt = config.robots?.index === false
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/nap-game', '/cay-thue', '/trung-gian', '/lien-he', '/wiki/giftcode', '/wiki/list', '/wiki/so-sanh', '/wiki/tier-list', '/wiki/map', '/wiki/build', '/wiki/team', '/wiki/thu-vien', '/wiki/huong-dan'].map((route) => `  <url><loc>${siteUrl}${route}</loc></url>`).join('\n')}\n</urlset>\n`

  return {
    name: 'figma-site-configuration',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!robotsTxt || req.url?.split('?')[0] !== '/robots.txt') return next()

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(robotsTxt)
      })
    },
    generateBundle() {
      this.emitFile({
      type: 'asset',
      fileName: 'robots.txt',
      source: robotsTxt,
      })
      if (config.robots?.index !== false) {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: sitemapXml,
      })
      }
    },
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      const indexPath = path.resolve(distDir, 'index.html')
      if (!fs.existsSync(indexPath)) return
      const baseHtml = fs.readFileSync(indexPath, 'utf-8')

      const SEO_ROUTES: Record<string, { title: string; description: string }> = {
        '/nap-game': {
          title: 'Nạp game online nhanh, an toàn | DUKE1305',
          description: 'Nạp game chính hãng, giá tốt, thanh toán an toàn và hỗ trợ 24/7.',
        },
        '/cay-thue': {
          title: 'Dịch vụ cày thuê game | DUKE1305',
          description: 'Thông tin gói cày thuê, giá dịch vụ và hỗ trợ tại DUKE1305.',
        },
        '/trung-gian': {
          title: 'Dịch vụ trung gian game | DUKE1305',
          description: 'Dịch vụ trung gian giao dịch game an toàn, minh bạch và hỗ trợ nhanh.',
        },
        '/lien-he': {
          title: 'Liên hệ hỗ trợ nạp game | DUKE1305',
          description: 'Liên hệ DUKE1305 để được hỗ trợ nạp game và xử lý giao dịch.',
        },
        '/wiki/giftcode': {
          title: 'Mã Giftcode Aniimo Mới Nhất & Code Tân Thủ | DUKE1305',
          description: 'Tổng hợp mã Giftcode Aniimo mới nhất còn hạn sử dụng, phần thưởng tinh thể, trứng cổ đại và hướng dẫn nhập code.',
        },
        '/wiki/list': {
          title: 'Danh Sách Thú Cưng Aniimo & Chỉ Số Chi Tiết | DUKE1305',
          description: 'Bảng tra cứu toàn bộ 98 thú cưng Aniimo, hệ nguyên tố, chỉ số công thủ HP và vị trí xuất hiện.',
        },
        '/wiki/so-sanh': {
          title: 'So Sánh Chỉ Số Thú Cưng Aniimo | DUKE1305',
          description: 'So sánh trực quan chỉ số, thuộc tính và sức mạnh giữa các thú cưng Aniimo trong game.',
        },
        '/wiki/tier-list': {
          title: 'Bảng Xếp Hạng Tier List Aniimo Mới Nhất | DUKE1305',
          description: 'Bảng xếp hạng thú cưng Aniimo từ bậc SSS đến C theo vai trò DPS, Tanker, Supporter và đa dụng.',
        },
        '/wiki/map': {
          title: 'Bản Đồ Vị Trí Thú Cưng Aniimo Map | DUKE1305',
          description: 'Bản đồ tương tác trực quan hiển thị vị trí bắt thú cưng, boss thế giới và tài nguyên trong Aniimo.',
        },
        '/wiki/build': {
          title: 'Xây Dựng Đội Hình Aniimo & Bảng Khắc Hệ | DUKE1305',
          description: 'Công cụ tự tạo đội hình thú cưng Aniimo, tính tổng chỉ số, radar năng lực và phân tích tương khắc nguyên tố.',
        },
        '/wiki/team': {
          title: 'Đội Hình Đề Cử & Chiến Thuật Aniimo | DUKE1305',
          description: 'Khám phá các đội hình mạnh nhất từ ban quản trị và cộng đồng người chơi Aniimo.',
        },
        '/wiki/thu-vien': {
          title: 'Bách Khoa Toàn Thư Aniimo | DUKE1305',
          description: 'Kho dữ liệu tra cứu vật phẩm, ngoại trang, nội thất gia viên, trứng ấp trong thế giới Aniimo.',
        },
        '/wiki/huong-dan': {
          title: 'Hướng Dẫn Tân Thủ Aniimo Chi Tiết | DUKE1305',
          description: 'Cẩm nang hướng dẫn chơi cho người mới bắt đầu: cách bắt thú, nâng cấp, phối đội hình và tối ưu tài nguyên.',
        },
      }

      for (const [route, meta] of Object.entries(SEO_ROUTES)) {
        const targetDir = path.resolve(distDir, route.replace(/^\//, ''))
        fs.mkdirSync(targetDir, { recursive: true })
        const canonical = `${siteUrl}${route}`
        let pageHtml = baseHtml
          .replace(/<title>.*?<\/title>/i, `<title>${meta.title}</title>`)
          .replace(/<meta name="description" content=".*?"\/?>/i, `<meta name="description" content="${meta.description}" />`)
          .replace(/<meta property="og:title" content=".*?"\/?>/i, `<meta property="og:title" content="${meta.title}" />`)
          .replace(/<meta property="og:description" content=".*?"\/?>/i, `<meta property="og:description" content="${meta.description}" />`)
          .replace(/<\/head>/i, `  <link rel="canonical" href="${canonical}" />\n  <meta property="og:url" content="${canonical}" />\n</head>`)

        fs.writeFileSync(path.resolve(targetDir, 'index.html'), pageHtml, 'utf-8')
      }
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let result = html
        result = replaceHtmlCommentSlot(result, 'figma:lang', language)
        result = replaceHtmlCommentSlot(result, 'figma:title', escapeHtmlText(title))
        result = replaceHtmlCommentSlot(result, 'figma:head-start', headStart)
        result = replaceHtmlCommentSlot(result, 'figma:head-end', headEnd)
        result = replaceHtmlCommentSlot(result, 'figma:body-start', bodyStart)
        result = replaceHtmlCommentSlot(result, 'figma:body-end', bodyEnd)

        const tags: HtmlTagDescriptor[] = []
        if (description) {
          tags.push({ tag: 'meta', attrs: { name: 'description', content: description }, injectTo: 'head' })
        }
        if (config.robots?.index === false) {
          tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' }, injectTo: 'head' })
        }
        if (favicon) {
          tags.push({ tag: 'link', attrs: { rel: 'icon', href: favicon }, injectTo: 'head' })
        }
        if (title) {
          tags.push({ tag: 'meta', attrs: { property: 'og:title', content: title }, injectTo: 'head' })
        }
        if (description) {
          tags.push({ tag: 'meta', attrs: { property: 'og:description', content: description }, injectTo: 'head' })
        }
        if (socialImage) {
          tags.push(
            { tag: 'meta', attrs: { property: 'og:image', content: socialImage }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:image', content: socialImage }, injectTo: 'head' },
          )
        }

        if (googleAnalyticsId) {
          tags.push(
            {
              tag: 'script',
              attrs: {
                async: true,
                src: `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`,
              },
              injectTo: 'head',
            },
            {
              tag: 'script',
              children: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', ${JSON.stringify(googleAnalyticsId)});
`,
              injectTo: 'head',
            },
          )
        }

        if (config.accessibility?.addBypassLinks) {
          tags.push(
            {
              tag: 'style',
              children: `
  .figma-bypass-link {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 2147483647;
    transform: translateY(-150%);
    border-radius: 6px;
    background: #111827;
    color: #fff;
    padding: 8px 12px;
    font: 600 14px/1.2 system-ui, sans-serif;
    text-decoration: none;
  }
  .figma-bypass-link:focus {
    transform: translateY(0);
  }
`,
              injectTo: 'head',
            },
            {
              tag: 'a',
              attrs: { class: 'figma-bypass-link', href: '#root' },
              children: 'Skip to content',
              injectTo: 'body-prepend',
            },
          )
        }

        return {
          html: result,
          tags,
        }
      },
    },
  }
}

/**
 * Replay the most recent build error to clients that connect after
 * it was first broadcast. Vite buffers an error payload only while
 * no clients are connected and clears the buffer on the first
 * reconnect (see `bufferedMessage` in `createWebSocketServer`), so
 * if the preview iframe reloads after Vite already delivered an
 * error to a live socket, the new socket misses the payload and
 * the overlay stays hidden even though the build is still broken.
 * We intercept `ws.send` to remember the latest error and replay
 * it on every new connection; the cache clears on a successful
 * `update` or `full-reload` so a stale overlay can't survive a
 * fixed build.
 */
function figmaErrorOverlayReplay(): Plugin {
  return {
    name: 'figma-error-overlay-replay',
    apply: 'serve',
    configureServer(server) {
      let lastError: object | null = null

      const origSend = server.ws.send.bind(server.ws) as (...args: any[]) => void
      server.ws.send = ((...args: any[]) => {
        const payload = args[0]
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const type = (payload as { type?: string }).type
          if (type === 'error') {
            lastError = payload as object
          } else if (type === 'update' || type === 'full-reload') {
            lastError = null
          }
        }
        return origSend(...args)
      }) as typeof server.ws.send

      server.ws.on('connection', (socket) => {
        if (lastError !== null) {
          socket.send(JSON.stringify(lastError))
        }
      })
    },
  }
}

/**
 * Reload when a module that previously defined a React Refresh boundary stops
 * defining one. This happens when an agent moves a component into a new file
 * and replaces the old module with a re-export:
 *
 *   export { default } from './app/App'
 *
 * Vite otherwise accepts the update using the previous module's HMR boundary,
 * but the re-export-only transform no longer registers a replacement for the
 * mounted component family. React reports a successful refresh while leaving
 * the old tree mounted until the page is reloaded.
 */
function figmaReactRefreshBoundaryFallback(): Plugin {
  const hadRefreshBoundary = new Map<string, boolean>()
  let sendFullReload: (() => void) | null = null

  return {
    name: 'figma-react-refresh-boundary-fallback',
    apply: 'serve',
    enforce: 'post',
    configureServer(server) {
      sendFullReload = () => server.ws.send({ type: 'full-reload', path: '*' })
    },
    transform(code, id) {
      if (!/\.[jt]sx?(?:\?|$)/.test(id) || id.includes('/node_modules/')) return null

      const moduleId = id.split('?')[0] ?? id
      const hasRefreshBoundary = code.includes('registerExportsForReactRefresh')
      const previousHadRefreshBoundary = hadRefreshBoundary.get(moduleId)
      hadRefreshBoundary.set(moduleId, hasRefreshBoundary)

      if (previousHadRefreshBoundary && !hasRefreshBoundary) {
        queueMicrotask(() => sendFullReload?.())
      }

      return null
    },
  }
}

/**
 * Serves a blank render-target page at /.figma/make/kit.html that
 * the Figma preview script drives directly. The page exposes a
 * registry of every file matching `storiesGlob` on
 * window.__FIGMA__.stories so the design surface can dynamically
 * import + mount each entry into its own grid view.
 *
 * Dev-only: `apply: 'serve'` gates the plugin to `vite dev`. Prod
 * builds (`vite build`) skip it entirely so the route doesn't leak
 * into shipped bundles.
 */
function figmaMakeKitPlugin(options: { storiesGlob: string | string[] }): Plugin {
  const storiesGlob = Array.isArray(options.storiesGlob) ? options.storiesGlob : [options.storiesGlob]
  const ROUTE = '/.figma/make/kit.html'
  const VIRTUAL_ID = 'virtual:figma-stories'
  const RESOLVED_ID = '\0' + VIRTUAL_ID
  const STORIES_MODULE = `export const stories = import.meta.glob(${JSON.stringify(storiesGlob)})`
  const HTML_BOOTSTRAP = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<div id="figma-make-kit-root"></div>
<script type="module">
  import { stories } from 'virtual:figma-stories'
  window.__FIGMA__ = Object.assign(window.__FIGMA__ ?? {}, { stories })
  window.dispatchEvent(new CustomEvent('figma.ready'))
</script>
</body>
</html>`

  return {
    name: 'figma-make-kit',
    apply: 'serve',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
      return null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      return STORIES_MODULE
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (url.split('?')[0] !== ROUTE) return next()

        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await server.transformIndexHtml(url, HTML_BOOTSTRAP))
        } catch (err) {
          next(err as Error)
        }
      })
    },
  }
}
