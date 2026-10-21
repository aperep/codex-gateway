import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/remote-workspace";
import { authenticatedFetch, E2E_PASSWORD, openApp, reloadApp } from "./helpers/app";
import { execRemoteSsh } from "./helpers/remote-codex";
import { sendRealtimeRawRequest, sendRealtimeRequest } from "./helpers/realtime";

test("accounts retain only their assigned folder and conversations on a shared Host", async ({
  page,
  browser,
  remoteWorkspace,
}) => {
  const runtimeUpdates = new Map<Page, Array<{ threadId: string; status: string }>>();
  const captureRuntime = (target: Page) => {
    const updates: Array<{ threadId: string; status: string }> = [];
    runtimeUpdates.set(target, updates);
    target.on("websocket", (socket) =>
      socket.on("framereceived", ({ payload }) => {
        const message = JSON.parse(payload.toString());
        if (message.type === "thread.runtime.updated") updates.push(message.update);
      }),
    );
  };
  captureRuntime(page);
  await openApp(page, { interceptRealtime: false });
  const remote = remoteWorkspace.remote;
  const root = `/tmp/gateway-account-scope-${randomUUID()}`;
  const alice = `${root}/alice`;
  const bob = `${root}/alice-other`;
  await execRemoteSsh(remote, `mkdir -p '${alice}' '${bob}'`);
  const host = await authenticatedFetch(
    page,
    {
      url: "/api/hosts",
      method: "POST",
      body: {
        name: "Shared workspace Host",
        sshHost: remote.host,
        port: Number(remote.port),
        username: remote.username,
        authMode: "password",
        password: remote.password,
        proxyUrl: null,
      },
    },
    (value) => value as { id: number },
  );
  const startThread = async (cwd: string) => {
    const result = await sendRealtimeRequest(page, {
      type: "thread.start",
      requestId: randomUUID(),
      hostId: host.id,
      cwd,
      model: remote.testModel ?? "gpt-6-luna",
      effort: "medium",
      approvalPolicy: "never",
    });
    if (result.type !== "thread.started") throw new Error("Expected a real Codex thread");
    await sendRealtimeRequest(page, {
      type: "turn.start",
      requestId: randomUUID(),
      hostId: host.id,
      threadId: result.threadId,
      text: "Reply OK. Do not call tools or change files.",
    });
    return result.threadId;
  };
  const aliceThread = await startThread(alice);
  const bobThread = await startThread(bob);
  const username = `workspace-bob-${Date.now()}`;
  await promisify(execFile)("node", ["scripts/create-user.mjs", username, E2E_PASSWORD]);
  const otherContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const otherPage = await otherContext.newPage();
  captureRuntime(otherPage);
  try {
    await otherPage.goto("/");
    await otherPage.getByTestId("login-username").fill(username);
    await otherPage.getByTestId("login-password").fill(E2E_PASSWORD);
    await otherPage.getByTestId("login-submit").click();
    await openApp(otherPage, { resetConfig: false, interceptRealtime: false });
    const config = await authenticatedFetch(
      page,
      { url: "/api/config/export" },
      (value) => value as { version: number; hosts: unknown[]; pinnedThreads: unknown[] },
    );
    for (const [target, cwd] of [
      [page, alice],
      [otherPage, bob],
    ] as const) {
      await authenticatedFetch(
        target,
        {
          url: "/api/config/sync",
          method: "POST",
          body: {
            ...config,
            workspaceRoots: [{ hostId: host.id, name: cwd.split("/").at(-1), remotePath: cwd }],
          },
        },
        () => undefined,
      );
      await reloadApp(target);
      const folders = await authenticatedFetch(
        target,
        { url: `/api/projects?hostId=${host.id}` },
        (value) => value as Array<{ remotePath: string }>,
      );
      expect(folders.map((folder) => folder.remotePath)).toEqual([cwd]);
      await expect(target.getByTestId(`project-button-${cwd}`)).toBeVisible();
      await expect(
        target.getByTestId(`project-button-${cwd === alice ? bob : alice}`),
      ).toBeHidden();
      const found: string[] = [];
      let cursor: string | null = null;
      do {
        const query = new URLSearchParams({ hostId: String(host.id), limit: "1" });
        if (cursor) query.set("cursor", cursor);
        const result = await authenticatedFetch(
          target,
          { url: `/api/threads?${query}` },
          (value) =>
            value as {
              data: Array<{ id: string; cwd?: string | null }>;
              nextCursor?: string | null;
            },
        );
        expect(result.data.every((thread) => thread.cwd === cwd)).toBe(true);
        found.push(...result.data.map((thread) => thread.id));
        cursor = result.nextCursor ?? null;
      } while (cursor);
      expect(found).toContain(cwd === alice ? aliceThread : bobThread);
      expect(found).not.toContain(cwd === alice ? bobThread : aliceThread);
      const forbidden = await sendRealtimeRawRequest(target, {
        type: "thread.activate",
        requestId: randomUUID(),
        hostId: host.id,
        threadId: cwd === alice ? bobThread : aliceThread,
      });
      expect(forbidden.type).toBe("error");
      const forbiddenStart = await sendRealtimeRawRequest(target, {
        type: "thread.start",
        requestId: randomUUID(),
        hostId: host.id,
        cwd: cwd === alice ? bob : alice,
        approvalPolicy: "never",
      });
      expect(forbiddenStart.type).toBe("error");
      const parent = await authenticatedFetch(
        target,
        {
          url: `/api/remote/directories?${new URLSearchParams({ hostId: String(host.id), path: root })}`,
        },
        (value) => value as { entries: Array<{ path: string }> },
      );
      expect(parent.entries.map((entry) => entry.path)).toEqual([cwd]);
      const browseStatus = await target.evaluate(
        async ({ hostId, path }) => {
          const token = localStorage.getItem("codex-gateway-auth-token");
          return (
            await fetch(
              `/api/remote/directories?${new URLSearchParams({ hostId: String(hostId), path })}`,
              { headers: { authorization: `Bearer ${token}` } },
            )
          ).status;
        },
        { hostId: host.id, path: cwd === alice ? bob : alice },
      );
      expect(browseStatus).toBe(403);
    }
    for (const updates of runtimeUpdates.values()) updates.length = 0;
    await sendRealtimeRequest(otherPage, {
      type: "turn.start",
      requestId: randomUUID(),
      hostId: host.id,
      threadId: bobThread,
      text: "Reply OK. Do not call tools or change files.",
    });
    await expect
      .poll(
        () =>
          runtimeUpdates
            .get(otherPage)
            ?.some((update) => update.threadId === bobThread && update.status !== "running"),
        { timeout: 60_000 },
      )
      .toBe(true);
    expect(runtimeUpdates.get(page)?.some((update) => update.threadId === bobThread)).toBe(false);
  } finally {
    await otherContext.close();
  }
});
