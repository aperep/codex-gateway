export interface TerminalOutputCoalescerOptions {
  onFlush: (data: string) => void;
  flushDelayMs?: number;
}

const DEFAULT_FLUSH_DELAY_MS = 5;

/**
 * Keeps interactive echo on the leading edge while merging sustained PTY bursts. This is the
 * same stream shape used by Paseo: terminal output is not allowed to become one WebSocket frame
 * per SSH chunk, but a quiet keystroke is still delivered without waiting for a timer.
 */
export class TerminalOutputCoalescer {
  private readonly onFlush: (data: string) => void;
  private readonly flushDelayMs: number;
  private pending: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastFlushAt: number | null = null;

  constructor(options: TerminalOutputCoalescerOptions) {
    this.onFlush = options.onFlush;
    this.flushDelayMs = options.flushDelayMs ?? DEFAULT_FLUSH_DELAY_MS;
  }

  handle(data: string) {
    if (data.length === 0) return;
    this.pending.push(data);
    if (this.timer !== null) return;

    const elapsed =
      this.lastFlushAt === null ? Number.POSITIVE_INFINITY : Date.now() - this.lastFlushAt;
    if (elapsed >= this.flushDelayMs) {
      this.flush();
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.flushDelayMs);
  }

  flush() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending.length === 0) return;
    const data = this.pending.join("");
    this.pending = [];
    this.lastFlushAt = Date.now();
    this.onFlush(data);
  }

  dispose() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = [];
  }
}
