import type { HostRecord, ProjectRecord } from "~~/shared/types";

export function hostById(hosts: HostRecord[], hostId: number | null) {
  return hostId === null ? null : (hosts.find((host) => host.id === hostId) ?? null);
}

export function projectForDirectory(
  projects: ProjectRecord[],
  hostId: number | null,
  cwd: string | null,
) {
  return (
    projects.find((project) => project.hostId === hostId && project.remotePath === cwd) ?? null
  );
}
