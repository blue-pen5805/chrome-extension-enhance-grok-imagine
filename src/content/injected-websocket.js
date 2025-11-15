(() => {
  if (window.__grokWebSocketHookInstalled) {
    return;
  }
  window.__grokWebSocketHookInstalled = true;
  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket !== "function") {
    return;
  }
  let socketCounter = 0;
  const socketMap = new Map();
  const socketMeta = new WeakMap();

  const postMessage = (type, detail = {}) => {
    window.postMessage({
      source: "grok-websocket-hook",
      type,
      ...detail
    });
  };

  const cleanupSocket = (socketId) => {
    const entry = socketMap.get(socketId);
    if (!entry) {
      return;
    }
    entry.socket.removeEventListener("close", entry.cleanup);
    entry.socket.removeEventListener("error", entry.cleanup);
    socketMap.delete(socketId);
    postMessage("GROK_WS_CLOSED", { socketId });
  };

  const registerSocket = (socket, meta = {}) => {
    const socketId = ++socketCounter;
    const cleanup = () => cleanupSocket(socketId);
    socketMap.set(socketId, { socket, cleanup });
    socketMeta.set(socket, { socketId });
    socket.addEventListener("close", cleanup, { once: true });
    socket.addEventListener("error", cleanup, { once: true });
    postMessage("GROK_WS_OPEN", { socketId, url: meta.url ?? socket.url ?? null });
    return socketId;
  };

  const logSend = (socketId, payload) => {
    postMessage("GROK_WS_SEND", { socketId, payloadType: typeof payload });
  };

  class GrokWebSocket extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      try {
        registerSocket(this, { url: args?.[0] });
      } catch (error) {
        postMessage("GROK_WS_ERROR", { reason: error?.message ?? String(error) });
      }
    }
  }

  Object.setPrototypeOf(GrokWebSocket, NativeWebSocket);
  const originalSend = NativeWebSocket.prototype.send;
  GrokWebSocket.prototype = NativeWebSocket.prototype;
  window.WebSocket = GrokWebSocket;

  NativeWebSocket.prototype.send = function patchedSend(...args) {
    try {
      const meta = socketMeta.get(this);
      if (meta) {
        logSend(meta.socketId, args[0]);
      }
    } catch (error) {
      postMessage("GROK_WS_ERROR", { reason: error?.message ?? String(error) });
    }
    return originalSend.apply(this, args);
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "grok-content-script") {
      return;
    }
    if (event.data.type === "GROK_WS_FORCE_CLOSE") {
      socketMap.forEach(({ socket }) => {
        try {
          socket.close(4400, event.data.reason || "Grok Imagine Enhancer");
        } catch (error) {
          postMessage("GROK_WS_ERROR", { reason: error?.message ?? String(error) });
        }
      });
    }
  });
})();
