import { useEventListener } from "@vueuse/core";
import type { MaybeRefOrGetter } from "vue";
import { toValue, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useGatewayFileWorkspaceStore } from "@/stores/file-workspace";
import { useFileGitWorkspaceStore } from "@/stores/file-workspace/git/workspace";
import { isPathWithinRoot } from "@/stores/file-workspace/paths";
import { useFileWorkspaceWatch } from "./useFileWorkspaceWatch";

const MAX_FILE_WATCH_PATHS = 256;

export function useFileWorkspaceLifecycle(input: {
  hostId: MaybeRefOrGetter<number>;
  threadId: MaybeRefOrGetter<string>;
  rootPath: MaybeRefOrGetter<string>;
  active: MaybeRefOrGetter<boolean>;
}) {
  const workspace = useGatewayFileWorkspaceStore();
  const gitWorkspace = useFileGitWorkspaceStore();
  const auth = useAuthStore();
  auth.hydrate();
  const refreshGitWorkspace = () => {
    const rootPath = toValue(input.rootPath);
    if (rootPath === "") return Promise.resolve(null);
    return gitWorkspace.load({ hostId: toValue(input.hostId), cwd: rootPath, rootPath });
  };

  const revalidate = () => {
    if (!auth.isAuthenticated) return Promise.resolve([]);
    return Promise.all([
      workspace.revalidateActiveFile(toValue(input.hostId), toValue(input.threadId)),
      workspace.refreshExpandedDirectories(toValue(input.hostId), toValue(input.threadId)),
      refreshGitWorkspace(),
    ]);
  };

  useFileWorkspaceWatch({
    hostId: input.hostId,
    cwd: input.rootPath,
    threadId: input.threadId,
    active: input.active,
    authenticated: () => auth.isAuthenticated,
    paths: () => watchedWorkspacePaths(workspace, input),
    onReady: revalidate,
  });

  watch(
    () =>
      [
        toValue(input.hostId),
        toValue(input.threadId),
        toValue(input.rootPath),
        auth.isAuthenticated,
      ] as const,
    async ([hostId, threadId, rootPath, authenticated]) => {
      if (!rootPath || !authenticated) return;
      workspace.setScopeRoot({ hostId, threadId, rootPath });
      await workspace.restoreScope(hostId, threadId);
      await gitWorkspace.load({ hostId, cwd: rootPath, rootPath });
    },
    { immediate: true },
  );
  watch(
    () => toValue(input.active),
    (active) => active === true && void revalidate(),
    { immediate: true },
  );
  watch(
    () => workspace.activeDocumentFor(toValue(input.hostId), toValue(input.threadId))?.stale,
    (stale) =>
      stale === true &&
      toValue(input.active) === true &&
      void workspace.revalidateActiveFile(toValue(input.hostId), toValue(input.threadId)),
  );
  useEventListener(document, "visibilitychange", () => {
    if (document.visibilityState === "visible" && toValue(input.active) === true) void revalidate();
  });
}

function watchedWorkspacePaths(
  workspace: ReturnType<typeof useGatewayFileWorkspaceStore>,
  input: {
    hostId: MaybeRefOrGetter<number>;
    threadId: MaybeRefOrGetter<string>;
    rootPath: MaybeRefOrGetter<string>;
  },
) {
  const rootPath = toValue(input.rootPath);
  const scope = workspace.scopeFor(toValue(input.hostId), toValue(input.threadId));
  if (rootPath === "" || scope === null) return rootPath === "" ? [] : [rootPath];
  // Keep open documents ahead of expanded folders when the protocol cap is reached: editor
  // freshness is more important than observing an offscreen branch, and the root remains first so
  // top-level additions are always visible.
  return [...new Set([rootPath, ...scope.openPaths, ...scope.expandedPaths])]
    .filter((path) => path === rootPath || isPathWithinRoot(rootPath, path))
    .slice(0, MAX_FILE_WATCH_PATHS);
}
