import type { Metadata, Viewport } from "next"
import AccessGate from "./components/AccessGate"

export const metadata: Metadata = {
  title: "CodeSync",
  description: "AI Project State Engine",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CodeSync"
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0a0a0f" />
        <style>{`
          :root {
            --bg: #f5f5f7;
            --card: #ffffff;
            --border: #e5e5ea;
            --header-bg: #ffffff;
            --title: #1c1c1e;
            --subtitle: #8e8e93;
            --repo: #8e8e93;
            --arrow: #c7c7cc;
            --muted: #8e8e93;
            --code: #1c1c1e;
            --input-bg: #ffffff;
            --section-bg: #f9f9fb;
            --divider: #f2f2f7;
            --sticky-bg: #f5f5f7;
          }

          [data-theme="dark"] {
            --bg: #0a0a0f;
            --card: #12121a;
            --border: #1e1e2e;
            --header-bg: #0d0d14;
            --title: #e8e8f0;
            --subtitle: #5a5a7a;
            --repo: #4a4a6a;
            --arrow: #3a3a5a;
            --muted: #5a5a7a;
            --code: #c8c8d8;
            --input-bg: #12121a;
            --section-bg: #0f0f18;
            --divider: #1a1a2a;
            --sticky-bg: #0a0a0f;
          }

          * { box-sizing: border-box; }

          body {
            margin: 0;
            padding: 0;
            background-color: var(--bg);
            color: var(--title);
            transition: background-color 0.2s, color 0.2s;
          }

          /* Cards */
          .cs-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
          }

          /* Header */
          .cs-header {
            position: sticky;
            top: 0;
            background: var(--header-bg);
            border-bottom: 1px solid var(--border);
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10;
            transition: background 0.2s, border-color 0.2s;
          }

          /* Sticky bar */
          .cs-sticky-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 12px 16px 24px;
            background: var(--sticky-bg);
            border-top: 1px solid var(--border);
            z-index: 50;
          }

          /* Section header */
          .cs-section-header {
            padding: 8px 16px;
            background: var(--section-bg);
            border-bottom: 1px solid var(--divider);
          }

          /* Divider */
          .cs-divider {
            border-top: 1px solid var(--divider);
          }

          /* Text colors */
          .cs-title { color: var(--title); }
          .cs-subtitle { color: var(--subtitle); }
          .cs-muted { color: var(--muted); }
          .cs-code { color: var(--code); font-family: 'SF Mono', 'Fira Code', monospace; }

          /* Input */
          .cs-input {
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            color: var(--title);
          }

          .cs-input input {
            background: transparent;
            color: var(--title);
            border: none;
            outline: none;
          }

          /* Button secondary */
          .cs-btn-secondary {
            background: var(--card);
            border: 1px solid var(--border);
            color: var(--title);
            border-radius: 12px;
            cursor: pointer;
          }
        `}</style>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              const theme = localStorage.getItem('codesync-theme') || 'light';
              document.documentElement.setAttribute('data-theme', theme);
            } catch(e) {}
          `
        }} />
      </head>
      <body>
        <AccessGate>{children}</AccessGate>
      </body>
    </html>
  )
}
