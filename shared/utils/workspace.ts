/** Directory identity is scoped to a host; paths themselves can contain separators. */
export function workspaceDirectoryKey(hostId: number, cwd: string) {
  return `${hostId}:${encodeURIComponent(cwd)}`;
}
