export interface BrowserPreviewTarget {
  hostId: number;
  cwd?: string | null;
  threadId?: string | null;
  panelId: string;
  targetUrl: string;
  allowInsecureTls?: boolean;
}

export interface BrowserPreviewSessionSnapshot extends BrowserPreviewTarget {
  sessionId: string;
  previewOrigin: string;
  bootstrapUrl: string;
  status: "open" | "closed";
}

export interface BrowserPreviewResourceFailure {
  statusCode: number;
  method: string;
  path: string;
  destination: string;
  occurredAt: string;
}
