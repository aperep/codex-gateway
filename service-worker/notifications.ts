import { webPushPayloadSchema } from "../shared/notifications/web-push";

// Worker globals have a separate TS project so DOM and WebWorker event overloads cannot mix.
// Use the standard Push API lifecycle; there is deliberately no fetch handler or app cache.
if (!(self instanceof ServiceWorkerGlobalScope)) throw new Error("Expected a service worker");
const worker: ServiceWorkerGlobalScope = self;

worker.addEventListener("install", (event) => event.waitUntil(worker.skipWaiting()));
worker.addEventListener("activate", (event) => event.waitUntil(worker.clients.claim()));
worker.addEventListener("push", (event) => {
  if (event.data === null) return;
  const payload = webPushPayloadSchema.parse(event.data.json());
  event.waitUntil(
    worker.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      data: { url: payload.url },
    }),
  );
});

worker.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openNotification(event.notification.data));
});

async function openNotification(data: unknown) {
  const path =
    typeof data === "object" && data !== null && "url" in data && typeof data.url === "string"
      ? data.url
      : "/";
  const url = new URL(path, worker.location.origin);
  if (url.origin !== worker.location.origin) return;
  const pages = await worker.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const page of pages) {
    if (new URL(page.url).origin !== url.origin) continue;
    await page.navigate(url.href);
    await page.focus();
    return;
  }
  await worker.clients.openWindow(url.href);
}
