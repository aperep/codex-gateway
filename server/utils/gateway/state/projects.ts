import type { ProjectCreateInput, ProjectRecord } from "~~/shared/types";
import { currentGatewayMemoryState, nowIso } from "./memory";

// Directory groups are navigation state, not a second persistent project catalog. Codex owns
// thread cwd; pins identify threads independently, so neither needs a Gateway-generated ID.
export const projectStore = {
  pruneToHosts(hostIds: Set<number>) {
    currentGatewayMemoryState().projects = this.list().filter((project) =>
      hostIds.has(project.hostId),
    );
  },

  deleteForHost(hostId: number) {
    currentGatewayMemoryState().projects = this.list().filter(
      (project) => project.hostId !== hostId,
    );
  },

  list(hostId?: number): ProjectRecord[] {
    return currentGatewayMemoryState()
      .projects.filter((project) => hostId === undefined || project.hostId === hostId)
      .sort((left, right) => left.name.localeCompare(right.name));
  },

  get(hostId: number, cwd: string): ProjectRecord | null {
    return this.list(hostId).find((project) => project.remotePath === cwd.trim()) ?? null;
  },

  create(input: ProjectCreateInput): ProjectRecord {
    const existing = this.get(input.hostId, input.remotePath);
    const timestamp = nowIso();
    const project = {
      hostId: input.hostId,
      name: input.name.trim(),
      remotePath: input.remotePath.trim(),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    currentGatewayMemoryState().projects = [
      ...this.list().filter(
        (item) => item.hostId !== project.hostId || item.remotePath !== project.remotePath,
      ),
      project,
    ];
    return project;
  },

  ensureForPath(hostId: number, remotePath: string): ProjectRecord {
    const cwd = remotePath.trim();
    return (
      this.get(hostId, cwd) ??
      this.create({
        hostId,
        remotePath: cwd,
        name:
          cwd
            .split("/")
            .filter((part) => part !== "")
            .at(-1) ?? "root",
      })
    );
  },

  count() {
    return currentGatewayMemoryState().projects.length;
  },
};
