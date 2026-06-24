import type { Metadata, Viewport } from "next"

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
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: "#0a0a0f" }}>
        {children}
      </body>
    </html>
  )
}
