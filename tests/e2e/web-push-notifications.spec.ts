import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test as remoteTest } from "./fixtures/remote-workspace";
import { openApp, reloadApp } from "./helpers/app";
import { configureBarkNotifications, useBarkReceiver } from "./helpers/bark";
import { sendTextTurn } from "./helpers/remote-codex";
import { AGENT_OUTPUT_TIMEOUT_MS } from "./helpers/timeouts";

// Chromium disables Web Push in incognito contexts (the default Playwright fixture). Use its
// official persistent context API, with an isolated profile removed on teardown, to exercise the
// real push service without replacing PushManager, subscriptions, or worker events.
const test = remoteTest.extend<{ pushPage: Page }>({
  pushPage: async ({ playwright, baseURL }, use) => {
    const profile = await mkdtemp(join(tmpdir(), "gateway-web-push-"));
    const context = await playwright.chromium.launchPersistentContext(profile, {
      baseURL,
      channel: "chromium",
      headless: true,
      permissions: ["notifications"],
      ignoreDefaultArgs: ["--disable-background-networking"],
    });
    try {
      // Keep the ordinary sender fixture intact; the second browser is the notification
      // recipient, just as a user can send from one window and receive OS push in another.
      const page = context.pages()[0] ?? (await context.newPage());
      await page.bringToFront();
      await use(page);
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  },
});

// Loopback is a browser-recognized secure context without a test-only HTTPS proxy.
test.use({
  baseURL: "http://127.0.0.1:3100",
  trace: "retain-on-failure",
});

test("browser notifications survive reload, take priority over Bark, and can be disabled", async ({
  page,
  pushPage,
  remoteWorkspace,
}) => {
  test.setTimeout(7 * 60_000);
  const bark = await useBarkReceiver();
  await openApp(page, { interceptRealtime: false });
  await configureBarkNotifications(page, bark.url, bark.deviceKey);
  await page.keyboard.press("Escape");
  const { project } = await remoteWorkspace.provision();
  await remoteWorkspace.startThread(project.remotePath);
  await openApp(pushPage, { resetConfig: false, interceptRealtime: false });
  await pushPage.getByTestId("settings-toggle").click();
  await pushPage.getByRole("tab", { name: "通知" }).click();
  await pushPage.getByTestId("web-push-browser-toggle").click();
  await expect(
    pushPage
      .getByText("此浏览器已启用")
      .or(pushPage.locator('[data-sonner-toast][data-type="error"]')),
  ).toBeVisible({ timeout: 90_000 });
  if (!(await pushPage.getByText("此浏览器已启用").isVisible())) {
    const service = await pushPage.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      // Origin only: endpoint paths are private browser capabilities and never belong in logs.
      return subscription == null ? "unavailable" : new URL(subscription.endpoint).origin;
    });
    throw new Error(
      `${await pushPage.locator('[data-sonner-toast][data-type="error"]').innerText()} (push service: ${service})`,
    );
  }
  // Authorizing this browser is complete without a second Save action. Exercise the actual
  // reported sequence: close settings immediately, reopen, then reload the browser.
  const enabled = pushPage.getByRole("switch", { name: "启用网页通知" });
  await expect(enabled).toBeChecked();
  await expect(enabled).toBeEnabled();
  await pushPage.keyboard.press("Escape");
  await pushPage.getByTestId("settings-toggle").click();
  await pushPage.getByRole("tab", { name: "通知" }).click();
  await expect(enabled).toBeChecked();
  await enabled.click();
  await expect(enabled).not.toBeChecked();
  await expect(enabled).toBeEnabled();
  await pushPage.keyboard.press("Escape");
  await pushPage.getByTestId("settings-toggle").click();
  await pushPage.getByRole("tab", { name: "通知" }).click();
  await expect(enabled).not.toBeChecked();
  await enabled.click();
  await expect(enabled).toBeChecked();
  await expect(enabled).toBeEnabled();
  await reloadApp(pushPage);
  await pushPage.getByTestId("settings-toggle").click();
  await pushPage.getByRole("tab", { name: "通知" }).click();
  await expect(pushPage.getByText("此浏览器已启用")).toBeVisible();
  await expect(pushPage.getByRole("switch", { name: "启用网页通知" })).toBeChecked();
  await pushPage.keyboard.press("Escape");
  await sendTextTurn(page, `Web Push priority ${Date.now()}`);
  // Observe notifications produced by the actual browser worker and remote push service. Do not
  // manufacture PushEvents, fake subscriptions, or replace the application WebSocket.
  await expect
    .poll(
      () =>
        pushPage.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration("/");
          return (
            (await registration?.getNotifications())?.map((notification) => notification.title) ??
            []
          );
        }),
      { timeout: AGENT_OUTPUT_TIMEOUT_MS },
    )
    .toContainEqual(expect.stringContaining("回合已结束"));
  expect(await bark.readRequests()).toHaveLength(0);

  await pushPage.getByTestId("settings-toggle").click();
  await pushPage.getByRole("tab", { name: "通知" }).click();
  await pushPage.getByTestId("web-push-browser-toggle").click();
  await expect(pushPage.getByText("此浏览器已启用")).toBeHidden();
  await pushPage.keyboard.press("Escape");
  await sendTextTurn(page, `Bark fallback ${Date.now()}`);
  await expect
    .poll(async () => (await bark.readRequests()).length, { timeout: AGENT_OUTPUT_TIMEOUT_MS })
    .toBe(1);
});
