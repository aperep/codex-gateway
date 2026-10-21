import { z } from "zod";
import { expect, test } from "./fixtures/remote-workspace";
import { authenticatedFetch, openApp, reloadApp } from "./helpers/app";
import { execRemoteSsh, sendTextTurn } from "./helpers/remote-codex";
import { AGENT_OUTPUT_TIMEOUT_MS } from "./helpers/timeouts";

test("pinned conversations restore their Codex directory without a stored Gateway project", async ({
  page,
  remoteWorkspace,
}) => {
  test.setTimeout(6 * 60_000);
  await openApp(page, { interceptRealtime: false });
  const suffix = Date.now();
  const originalPath = `/home/codex/thread-root-${suffix}`;
  const otherPath = `/home/codex/other-root-${suffix}`;
  await execRemoteSsh(remoteWorkspace.remote, `mkdir -p '${originalPath}' '${otherPath}'`);
  try {
    const { host, project } = await remoteWorkspace.provision({ remotePath: originalPath });
    const threadId = await remoteWorkspace.startThread(project.remotePath);
    const ready = `root-ready-${suffix}`;
    await sendTextTurn(page, `只回复 ${ready}`);
    await expect(page.getByTestId("chat-scroll-area")).toContainText(ready, {
      timeout: AGENT_OUTPUT_TIMEOUT_MS,
    });
    await expect(page.getByTestId("send-turn-button")).toHaveAttribute("aria-label", "已完成", {
      timeout: AGENT_OUTPUT_TIMEOUT_MS,
    });
    await page.getByTestId(`thread-button-${threadId}`).click({ button: "right" });
    await page.getByRole("menuitem", { name: /置顶/ }).click();

    // Directory selection is transient navigation. A pin must restore the official thread cwd
    // after browsing elsewhere and reloading, with no local project record to resolve first.
    await remoteWorkspace.addProject(host.id, "Other directory", otherPath);
    await page.getByTestId(`pinned-thread-button-${threadId}`).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("cwd")).toBe(originalPath);
    await reloadApp(page);
    await page.getByTestId(`pinned-thread-button-${threadId}`).click();
    await sendTextTurn(page, "执行 pwd 命令，只回复实际工作目录。");
    await expect(page.getByTestId("chat-scroll-area")).toContainText(originalPath, {
      timeout: AGENT_OUTPUT_TIMEOUT_MS,
    });
    await expect(page.getByTestId("send-turn-button")).toHaveAttribute("aria-label", "已完成", {
      timeout: AGENT_OUTPUT_TIMEOUT_MS,
    });

    const config = await authenticatedFetch(page, { url: "/api/config/export" }, (value) =>
      z
        .object({
          version: z.literal(2),
          pinnedThreads: z.array(z.object({ hostId: z.number(), threadId: z.string() }).loose()),
        })
        .loose()
        .parse(value),
    );
    expect(config).not.toHaveProperty("projects");
    const pin = config.pinnedThreads.find((candidate) => candidate.threadId === threadId);
    expect(pin).toMatchObject({ hostId: host.id, threadId });
    expect(pin).not.toHaveProperty("projectId");
    expect(new URL(page.url()).searchParams.has("projectId")).toBe(false);
  } finally {
    await execRemoteSsh(remoteWorkspace.remote, `rm -rf '${originalPath}' '${otherPath}'`);
  }
});
