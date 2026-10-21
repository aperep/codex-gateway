import { expect, test } from "./fixtures/remote-workspace";
import { openApp } from "./helpers/app";
import { resetRemoteAppServer, selectSidebarThread, sendTextTurn } from "./helpers/remote-codex";
import {
  confirmHostDaemonRestart,
  openHostDaemonRestartDialog,
  readDaemonPid,
} from "./helpers/host-daemon";

test("restarts one host daemon from settings and restores an already-open conversation", async ({
  page,
  context,
  remoteWorkspace,
}, testInfo) => {
  test.setTimeout(7 * 60_000);
  await openApp(page, { interceptRealtime: false });
  await resetRemoteAppServer(remoteWorkspace.remote);
  const { host, project } = await remoteWorkspace.provision();
  const threadId = await remoteWorkspace.startThread(project.remotePath);
  const before = `daemon-before-${Date.now()}`;
  await sendTextTurn(page, before);
  await expect(page.getByTestId("chat-scroll-area").getByText(before, { exact: true })).toBeVisible(
    {
      timeout: 180_000,
    },
  );
  await expect(page.getByTestId("send-turn-button")).toHaveAttribute("aria-label", "已完成", {
    timeout: 180_000,
  });
  const previousPid = await readDaemonPid(remoteWorkspace.remote);

  const otherPage = await context.newPage();
  try {
    await openApp(otherPage, { resetConfig: false, interceptRealtime: false });
    await selectSidebarThread(otherPage, threadId);
    await expect(
      otherPage.getByTestId("chat-scroll-area").getByText(before, { exact: true }),
    ).toBeVisible();

    await openHostDaemonRestartDialog(page, host.id);
    await page.getByRole("alertdialog").getByRole("button", { name: "取消", exact: true }).click();
    expect(await readDaemonPid(remoteWorkspace.remote)).toBe(previousPid);
    await expect(page.getByTestId("host-name-input")).toBeHidden();
    const edit = page.getByTestId(`host-edit-toggle-${host.id}`);
    await edit.click();
    await expect(
      page
        .getByTestId(`host-edit-form-${host.id}`)
        .getByRole("textbox", { name: "名称", exact: true }),
    ).toHaveValue(host.name);
    await edit.click();
    await expect(page.getByTestId(`host-edit-form-${host.id}`)).toBeHidden();
    await page
      .getByTestId("settings-dialog")
      .screenshot({ path: testInfo.outputPath("host-management-desktop.png") });
    await page.getByTestId(`host-daemon-restart-${host.id}`).click();
    await confirmHostDaemonRestart(page, host.name);
    expect(await readDaemonPid(remoteWorkspace.remote)).not.toBe(previousPid);

    const after = `daemon-after-${Date.now()}`;
    await sendTextTurn(page, after);
    // The second page remains open throughout the restart. A new reply must arrive without
    // refreshing or switching threads, proving that its original upstream lease was restored.
    await expect(
      otherPage.getByTestId("chat-scroll-area").getByText(after, { exact: true }),
    ).toBeVisible({
      timeout: 180_000,
    });
    await expect(page.getByTestId("send-turn-button")).toHaveAttribute("aria-label", "已完成", {
      timeout: 180_000,
    });
  } finally {
    await otherPage.close();
  }
});
