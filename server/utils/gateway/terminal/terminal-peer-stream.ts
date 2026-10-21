import type { RealtimePeer } from "../realtime/peer-state";

const MAX_BUFFERED_BYTES = 2 * 1024 * 1024;
const DRAIN_THRESHOLD_BYTES = 512 * 1024;
const MAX_PENDING_FRAMES = 256;
const MAX_PENDING_BYTES = 1 * 1024 * 1024;

/**
 * Applies the same bounded, drain-aware delivery model as Paseo's terminal stream. SSH output
 * must never wait for a slow browser, and a disconnected browser must not leave an unbounded
 * binary queue attached to the realtime connection.
 */
export class TerminalPeerStream {
  private readonly pending: Uint8Array[] = [];
  private pendingBytes = 0;
  private drainTask: Promise<void> | undefined;
  private readonly drainAbort = new AbortController();
  private closed = false;

  constructor(private readonly peer: RealtimePeer) {}

  send(frame: Uint8Array) {
    if (this.closed) return;
    if (this.pending.length > 0 || this.bufferedAmount > DRAIN_THRESHOLD_BYTES) {
      if (!this.enqueue(frame)) {
        this.fail("Terminal output buffer limit exceeded");
        return;
      }
      this.scheduleDrain();
      return;
    }
    this.safeSend(frame);
  }

  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.drainAbort.abort();
    this.pending.length = 0;
    this.pendingBytes = 0;
  }

  private get bufferedAmount() {
    return this.peer.bufferedAmount ?? 0;
  }

  private enqueue(frame: Uint8Array) {
    if (
      this.pending.length >= MAX_PENDING_FRAMES ||
      this.pendingBytes + frame.byteLength > MAX_PENDING_BYTES
    ) {
      return false;
    }
    this.pending.push(frame);
    this.pendingBytes += frame.byteLength;
    return true;
  }

  private scheduleDrain() {
    this.drainTask ??= this.drain().finally(() => {
      this.drainTask = undefined;
      if (!this.closed && this.pending.length > 0) this.scheduleDrain();
    });
  }

  private async drain() {
    while (!this.closed && this.pending.length > 0) {
      if (this.bufferedAmount > DRAIN_THRESHOLD_BYTES && this.peer.waitForDrain !== undefined) {
        try {
          await this.peer.waitForDrain({
            threshold: DRAIN_THRESHOLD_BYTES,
            signal: this.drainAbort.signal,
          });
        } catch {
          return;
        }
      }
      const frame = this.pending.shift();
      if (frame === undefined) return;
      this.pendingBytes -= frame.byteLength;
      this.safeSend(frame);
    }
  }

  private safeSend(frame: Uint8Array) {
    if (this.bufferedAmount + frame.byteLength > MAX_BUFFERED_BYTES) {
      this.fail("Terminal output buffer limit exceeded");
      return;
    }
    try {
      this.peer.send(frame);
    } catch {
      this.fail("Realtime terminal stream failed");
    }
  }

  private fail(reason: string) {
    this.dispose();
    this.peer.close(1009, reason);
  }
}
