import {
  cleanupRealtimePeer,
  handleRealtimePeerMessage,
  handleRealtimePeerBinaryMessage,
  openRealtimePeer,
} from "../utils/gateway/realtime/connection";

export default defineWebSocketHandler({
  open(peer) {
    openRealtimePeer(peer);
  },

  async message(peer, message) {
    if (typeof message.rawData === "string") {
      await handleRealtimePeerMessage(peer, message.text());
      return;
    }
    await handleRealtimePeerBinaryMessage(peer, message.uint8Array());
  },

  close(peer) {
    cleanupRealtimePeer(peer);
  },

  error(peer) {
    cleanupRealtimePeer(peer);
  },
});
