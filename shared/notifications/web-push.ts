import { z } from "zod";

// Push endpoints are capabilities supplied by the browser. Restrict them to real browser push
// services so an authenticated subscription cannot turn the server into an arbitrary HTTPS proxy.
const pushServiceHosts = new Set([
  "fcm.googleapis.com",
  // Chromium's field-trial builds can use Google's staging Web Push endpoint. Keep the exact
  // vendor host, rather than accepting all google.com addresses or rewriting browser endpoints.
  "jmt17.google.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
]);

export const webPushEndpointSchema = z
  .url()
  .max(4096)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      (pushServiceHosts.has(url.hostname) ||
        url.hostname.endsWith(".push.apple.com") ||
        url.hostname.endsWith(".notify.windows.com"))
    );
  }, "Unsupported browser push service");

export const webPushSubscriptionSchema = z
  .object({
    endpoint: webPushEndpointSchema,
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/),
        auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/),
      })
      .strict(),
  })
  .strict();

export type WebPushSubscription = z.infer<typeof webPushSubscriptionSchema>;

export const webPushPayloadSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    tag: z.string(),
    url: z.string().startsWith("/"),
  })
  .strict();

export type WebPushPayload = z.infer<typeof webPushPayloadSchema>;
