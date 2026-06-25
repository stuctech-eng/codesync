// CodeSync Service Worker — Push Notifications

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? "CodeSync"
  const options = {
    body: data.body ?? "Deployment update",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "codesync-deploy",
    renotify: true,
    data: { url: data.url ?? "/" }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(clients.openWindow(url))
})

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()))
