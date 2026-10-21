const TERMINAL_STREAM_HEADER_BYTES = 17;

export const terminalStreamOpcode = {
  output: 0x01,
  input: 0x02,
  resize: 0x03,
} as const;

export type TerminalStreamOpcode = (typeof terminalStreamOpcode)[keyof typeof terminalStreamOpcode];

export interface TerminalStreamFrame {
  opcode: TerminalStreamOpcode;
  sessionId: string;
  payload: Uint8Array;
}

export function encodeTerminalOutputFrame(sessionId: string, data: string) {
  return encodeTerminalStreamFrame(terminalStreamOpcode.output, sessionId, utf8Encode(data));
}

export function encodeTerminalInputFrame(sessionId: string, data: string) {
  return encodeTerminalStreamFrame(terminalStreamOpcode.input, sessionId, utf8Encode(data));
}

export function encodeTerminalResizeFrame(sessionId: string, cols: number, rows: number) {
  const payload = new Uint8Array(4);
  const view = new DataView(payload.buffer);
  view.setUint16(0, cols, false);
  view.setUint16(2, rows, false);
  return encodeTerminalStreamFrame(terminalStreamOpcode.resize, sessionId, payload);
}

export function decodeTerminalStreamFrame(data: Uint8Array): TerminalStreamFrame | null {
  if (data.byteLength < TERMINAL_STREAM_HEADER_BYTES) return null;

  const opcode = data.at(0);
  if (opcode === undefined || !isTerminalStreamOpcode(opcode)) return null;

  const sessionId = bytesToUuid(data.subarray(1, TERMINAL_STREAM_HEADER_BYTES));
  if (sessionId === null) return null;

  return {
    opcode,
    sessionId,
    payload: data.subarray(TERMINAL_STREAM_HEADER_BYTES),
  };
}

export function decodeTerminalTextPayload(frame: TerminalStreamFrame) {
  if (frame.opcode !== terminalStreamOpcode.output && frame.opcode !== terminalStreamOpcode.input) {
    return null;
  }
  return utf8Decode(frame.payload);
}

export function decodeTerminalResizePayload(frame: TerminalStreamFrame) {
  if (frame.opcode !== terminalStreamOpcode.resize || frame.payload.byteLength !== 4) return null;
  const view = new DataView(
    frame.payload.buffer,
    frame.payload.byteOffset,
    frame.payload.byteLength,
  );
  return { cols: view.getUint16(0, false), rows: view.getUint16(2, false) };
}

function encodeTerminalStreamFrame(
  opcode: TerminalStreamOpcode,
  sessionId: string,
  payload: Uint8Array,
) {
  const sessionBytes = uuidToBytes(sessionId);
  const frame = new Uint8Array(TERMINAL_STREAM_HEADER_BYTES + payload.byteLength);
  frame[0] = opcode;
  frame.set(sessionBytes, 1);
  frame.set(payload, TERMINAL_STREAM_HEADER_BYTES);
  return frame;
}

function isTerminalStreamOpcode(value: number): value is TerminalStreamOpcode {
  return (
    value === terminalStreamOpcode.output ||
    value === terminalStreamOpcode.input ||
    value === terminalStreamOpcode.resize
  );
}

function uuidToBytes(value: string) {
  const normalized = value.replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/i.test(normalized)) {
    throw new Error(`Invalid terminal session id: ${value}`);
  }
  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array) {
  if (bytes.byteLength !== 16) return null;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function utf8Encode(value: string) {
  return new TextEncoder().encode(value);
}

function utf8Decode(value: Uint8Array) {
  return new TextDecoder().decode(value);
}
