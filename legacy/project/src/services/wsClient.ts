import { useSmartHomeStore } from '../store/useSmartHomeStore';

const wsClients = new Map<string, WebSocket>();
const reconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const reconnectAttempts = new Map<string, number>();

export const connectLocalWS = (boardId: string, espIp: string) => {
  if (!espIp || !boardId) return;
  
  const existingWs = wsClients.get(boardId);
  if (existingWs?.readyState === WebSocket.OPEN || existingWs?.readyState === WebSocket.CONNECTING) return;
  
  const store = useSmartHomeStore.getState();
  const WS_URL = `ws://${espIp}:82`;
  
  const ws = new WebSocket(WS_URL);
  wsClients.set(boardId, ws);

  ws.onopen = () => {
    store.setIsConnected(true);
    reconnectAttempts.set(boardId, 0);
    // Send Authentication Packet
    ws.send(JSON.stringify({ type: "auth", password: store.wsPassword }));
  };

  ws.onclose = () => {
    // If we have no active connections left, set global connected state to false
    const activeConnections = Array.from(wsClients.values()).filter(c => c.readyState === WebSocket.OPEN);
    if (activeConnections.length === 0) {
      store.setIsConnected(false);
      store.setIsAuthenticated(false);
    }
    
    wsClients.delete(boardId);

    // Exponential backoff
    const attempts = reconnectAttempts.get(boardId) || 0;
    let backoff = Math.min(Math.pow(2, attempts) * 1000, 30000);

    const timeout = setTimeout(() => {
      reconnectAttempts.set(boardId, attempts + 1);
      connectLocalWS(boardId, espIp);
    }, backoff);
    reconnectTimeouts.set(boardId, timeout);
  };

  ws.onerror = () => {
    const activeConnections = Array.from(wsClients.values()).filter(c => c.readyState === WebSocket.OPEN);
    if (activeConnections.length === 0) {
      store.setIsConnected(false);
      store.setIsAuthenticated(false);
    }
  };

  ws.onmessage = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      const currentStore = useSmartHomeStore.getState();

      if (data.type === "auth_success") {
        currentStore.setIsAuthenticated(true);
        ws.send(JSON.stringify({ type: "refresh" }));
      } else if (data.type === "auth_error") {
        // Only set unauth if no other ws is authenticated, but wait, auth is global?
        currentStore.setIsAuthenticated(false);
      } else if (data.type === "state") {
        const receivedBoardId = data.boardId || boardId; // Fallback to boardId we used to connect
        if (Array.isArray(data.devices)) currentStore.setDevices(data.devices, receivedBoardId);
        if (data.totalKWh !== undefined) {
          currentStore.setGlobalData({
            totalKWh: data.totalKWh || 0,
            currentPower: data.currentPower || 0,
            currentTemp: data.currentTemp || 0,
            currentHum: data.currentHum || 0
          });
          currentStore.addPowerDataPoint(data.currentPower || 0);
        }
      } else if (data.type === "alarm") {
        currentStore.setMotionAlert(true);
        currentStore.addActivityLog(data.message || "حركة غير طبيعية (PIR)");
      }
    } catch (err) {
      console.error("WS Data Error", err);
    }
  };
};

export const publishLocalCommand = (boardId: string, payload: object) => {
  const ws = wsClients.get(boardId);
  if (ws?.readyState === WebSocket.OPEN && useSmartHomeStore.getState().isAuthenticated) {
    ws.send(JSON.stringify(payload));
  } else {
    console.warn(`Cannot send command to board ${boardId}: Local WS not connected or authenticated`);
  }
};

export const disconnectLocalWS = (boardId?: string) => {
  if (boardId) {
    const ws = wsClients.get(boardId);
    if (ws) {
      ws.close();
      wsClients.delete(boardId);
    }
    const timeout = reconnectTimeouts.get(boardId);
    if (timeout) {
      clearTimeout(timeout);
      reconnectTimeouts.delete(boardId);
    }
  } else {
    wsClients.forEach(ws => ws.close());
    wsClients.clear();
    reconnectTimeouts.forEach(timeout => clearTimeout(timeout));
    reconnectTimeouts.clear();
  }
};
