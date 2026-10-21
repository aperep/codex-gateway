import { expect, type Page } from "@playwright/test";
import { z } from "zod";
import { execRemoteSsh, type RemoteCodexEnv } from "./remote-codex";

export async function readDaemonPid(remote: RemoteCodexEnv) {
  // daemon version reports versions, not process identity. Inspect the real managed process
  // on the Linux SSH fixtures without coupling the browser scenario to internal PID-file paths.
  const result = await execRemoteSsh(
    remote,
    `ps -eo pid=,args= | awk '$2 ~ /\\/codex$/ && $3 == "app-server" && index($0, "--managed-daemon") { print $1 }'`,
  );
  return z.coerce.number().int().positive().parse(result.stdout.trim());
}

export async function openHostDaemonRestartDialog(page: Page, hostId: number) {
  await page.getByTestId("settings-toggle").click();
  await page.getByRole("tab", { name: "主机", exact: true }).click();
  // Maintenance is a visible row action, independent of opening the SSH credential editor.
  await expect(page.getByTestId(`host-edit-form-${hostId}`)).toBeHidden();
  await expect(page.getByTestId(`host-management-status-${hostId}`)).toHaveAttribute(
    "data-status",
    "connected",
  );
  const restart = page.getByTestId(`host-daemon-restart-${hostId}`);
  await expect(restart).toBeEnabled();
  await restart.click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
}

export async function confirmHostDaemonRestart(page: Page, hostName: string) {
  await page.getByTestId("confirm-host-daemon-restart").click();
  await expect(page.getByText(`${hostName} 的 Codex daemon 已重启并重新连接`)).toBeVisible({
    timeout: 120_000,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("settings-dialog")).toBeHidden();
}
