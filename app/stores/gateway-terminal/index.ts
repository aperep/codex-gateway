import { computed, reactive, toRefs } from "vue";
import { defineStore } from "pinia";
import type { TerminalSessionSnapshot } from "~~/shared/types";
import type { TerminalSessionState } from "../gateway/types";

const MAX_TERMINAL_OUTPUT_CHUNKS = 200;
const MAX_TERMINAL_OUTPUT_CHARS = 256 * 1024;

interface GatewayTerminalState {
  terminalSessions: Record<string, TerminalSessionState>;
}

export const useGatewayTerminalStore = defineStore("gateway-terminal", () => {
  const state = reactive<GatewayTerminalState>(createTerminalState());
  const pendingOutputs = new Map<string, string>();
  const pendingFlushes = new Map<string, number>();

  const terminalSessionSnapshots = computed(() => Object.values(state.terminalSessions));

  function replaceTerminalSessions(sessions: TerminalSessionSnapshot[]) {
    const nextSessions: Record<string, TerminalSessionState> = {};
    for (const session of sessions) {
      nextSessions[session.sessionId] = normalizeTerminalSession(session);
    }
    state.terminalSessions = nextSessions;
  }

  function upsertTerminalSession(session: TerminalSessionSnapshot) {
    state.terminalSessions = {
      ...state.terminalSessions,
      [session.sessionId]: normalizeTerminalSession(session),
    };
  }

  function appendTerminalOutput(sessionId: string, data: string) {
    if (!state.terminalSessions[sessionId]) return;
    pendingOutputs.set(sessionId, `${pendingOutputs.get(sessionId) ?? ""}${data}`);
    if (pendingFlushes.has(sessionId)) return;
    const flush = () => {
      pendingFlushes.delete(sessionId);
      const output = pendingOutputs.get(sessionId);
      pendingOutputs.delete(sessionId);
      if (output === undefined) return;
      const session = state.terminalSessions[sessionId];
      if (!session) return;
      state.terminalSessions = {
        ...state.terminalSessions,
        [sessionId]: {
          ...session,
          ...appendOutputChunk(session, output),
          lastActiveAt: new Date().toISOString(),
        },
      };
    };
    const handle =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(flush)
        : window.setTimeout(flush, 16);
    pendingFlushes.set(sessionId, handle);
  }

  function markTerminalExited(sessionId: string, message: string) {
    const session = state.terminalSessions[sessionId];
    if (!session) {
      return;
    }
    state.terminalSessions = {
      ...state.terminalSessions,
      [sessionId]: {
        ...session,
        status: "closed",
        ...appendOutputChunk(session, `\r\n${message}\r\n`),
        lastActiveAt: new Date().toISOString(),
      },
    };
  }

  function removeTerminalSession(sessionId: string) {
    const pending = pendingFlushes.get(sessionId);
    if (pending !== undefined) {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(pending);
      else window.clearTimeout(pending);
      pendingFlushes.delete(sessionId);
    }
    pendingOutputs.delete(sessionId);
    const { [sessionId]: _removed, ...terminalSessions } = state.terminalSessions;
    state.terminalSessions = terminalSessions;
  }

  function resetState() {
    for (const handle of pendingFlushes.values()) {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle);
      else window.clearTimeout(handle);
    }
    pendingFlushes.clear();
    pendingOutputs.clear();
    Object.assign(state, createTerminalState());
  }

  return {
    ...toRefs(state),
    terminalSessionSnapshots,
    replaceTerminalSessions,
    upsertTerminalSession,
    appendTerminalOutput,
    markTerminalExited,
    removeTerminalSession,
    resetState,
  };
});

function createTerminalState(): GatewayTerminalState {
  return {
    terminalSessions: {},
  };
}

function normalizeTerminalSession(session: TerminalSessionSnapshot): TerminalSessionState {
  const chunks = session.output ? [session.output] : [];
  return {
    ...session,
    ...boundedOutput(chunks),
  };
}

function appendOutputChunk(session: TerminalSessionState, data: string) {
  return boundedOutput([...session.outputChunks, data]);
}

function boundedOutput(chunks: string[]) {
  let nextChunks = chunks.slice(-MAX_TERMINAL_OUTPUT_CHUNKS);
  let output = nextChunks.join("");
  while (output.length > MAX_TERMINAL_OUTPUT_CHARS && nextChunks.length > 1) {
    nextChunks = nextChunks.slice(1);
    output = nextChunks.join("");
  }
  if (output.length > MAX_TERMINAL_OUTPUT_CHARS) {
    output = output.slice(-MAX_TERMINAL_OUTPUT_CHARS);
    nextChunks = [output];
  }
  return {
    output,
    outputChunks: nextChunks,
  };
}
