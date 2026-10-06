const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');
const discovery = require('./discovery');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Pass Socket.IO instance to other modules
app.set('io', io);

// API Endpoints

// 1. Boards
app.get('/api/boards', (req, res) => {
  const boards = db.prepare('SELECT * FROM boards').all();
  res.json(boards);
});

app.get('/api/discovery/scan', (req, res) => {
  const devices = discovery.getDiscoveredDevices();
  res.json({ success: true, devices });
});

app.post('/api/boards', (req, res) => {
  const { id, name, ip } = req.body;
  db.prepare('INSERT OR REPLACE INTO boards (id, name, ip) VALUES (?, ?, ?)').run(id, name, ip);
  io.emit('boards_updated', db.prepare('SELECT * FROM boards').all());
  res.json({ success: true });
});

app.delete('/api/boards/:id', (req, res) => {
  db.prepare('DELETE FROM boards WHERE id = ?').run(req.params.id);
  io.emit('boards_updated', db.prepare('SELECT * FROM boards').all());
  io.emit('devices_updated', db.prepare('SELECT * FROM devices').all());
  res.json({ success: true });
});

// 2. Devices
app.get('/api/devices', (req, res) => {
  const devices = db.prepare('SELECT * FROM devices').all();
  res.json(devices);
});

// Endpoint to update device config from UI
app.post('/api/devices', (req, res) => {
  const { id, boardId, name, room, type, pin, inPin } = req.body;
  const existing = db.prepare('SELECT * FROM devices WHERE id = ? AND boardId = ?').get(id, boardId);
  
  if (existing) {
    db.prepare(`UPDATE devices SET name=?, room=?, type=?, pin=?, inPin=? WHERE id=? AND boardId=?`)
      .run(name, room, type, pin, inPin, id, boardId);
  } else {
    db.prepare(`INSERT INTO devices (id, boardId, name, room, type, pin, inPin) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, boardId, name, room, type, pin, inPin);
  }
  
  io.emit('devices_updated', db.prepare('SELECT * FROM devices').all());
  res.json({ success: true });
});

// Endpoint to reorder devices (Drag & Drop)
app.post('/api/devices/reorder', (req, res) => {
  const { items } = req.body; // Array of { id, boardId, orderIndex }
  
  if (items && Array.isArray(items)) {
     const stmt = db.prepare('UPDATE devices SET orderIndex = ? WHERE id = ? AND boardId = ?');
     
     const transaction = db.transaction((devices) => {
        for (const device of devices) {
           stmt.run(device.orderIndex, device.id, device.boardId);
        }
     });
     
     transaction(items);
     
     // Notify clients
     io.emit('devices_updated', db.prepare('SELECT * FROM devices ORDER BY orderIndex ASC').all());
  }
  
  res.json({ success: true });
});

// 3. Telemetry & Power History
app.get('/api/telemetry/history', (req, res) => {
  const history = db.prepare(`SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 100`).all();
  res.json(history.reverse()); // Chronological order
});

// 4. Logs
app.get('/api/logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100').all();
  res.json(logs);
});

app.delete('/api/logs', (req, res) => {
  db.prepare('DELETE FROM activity_logs').run();
  io.emit('logs_updated', []);
  res.json({ success: true });
});

// 5. Automations
app.get('/api/automations', (req, res) => {
  const automations = db.prepare('SELECT * FROM automations').all();
  // SQLite returns integers for booleans, map them
  const mapped = automations.map(a => ({...a, enabled: a.enabled === 1}));
  res.json(mapped);
});

app.post('/api/automations', (req, res) => {
  const { id, name, enabled, triggerType, triggerTime, triggerSensorType, triggerCondition, triggerValue, logicOperator, secondarySensorType, secondaryCondition, secondaryValue, actionDeviceId, actionBoardId, actionState } = req.body;
  
  db.prepare(`INSERT OR REPLACE INTO automations 
    (id, name, enabled, triggerType, triggerTime, triggerSensorType, triggerCondition, triggerValue, logicOperator, secondarySensorType, secondaryCondition, secondaryValue, actionDeviceId, actionBoardId, actionState) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, name, enabled ? 1 : 0, triggerType, triggerTime, triggerSensorType, triggerCondition, triggerValue, logicOperator || 'NONE', secondarySensorType, secondaryCondition, secondaryValue, actionDeviceId, actionBoardId, actionState);
  
  io.emit('automations_updated', db.prepare('SELECT * FROM automations').all().map(a => ({...a, enabled: a.enabled === 1})));
  res.json({ success: true });
});

app.delete('/api/automations/:id', (req, res) => {
  db.prepare('DELETE FROM automations WHERE id = ?').run(req.params.id);
  io.emit('automations_updated', db.prepare('SELECT * FROM automations').all().map(a => ({...a, enabled: a.enabled === 1})));
  res.json({ success: true });
});

// 6. Commands
app.post('/api/command', (req, res) => {
  const { boardId, payload } = req.body;
  const mqttClientModule = require('./mqttClient');
  if (mqttClientModule.client && mqttClientModule.client.connected) {
     mqttClientModule.client.publish(`home/${boardId}/command`, JSON.stringify(payload));
     res.json({ success: true });
  } else {
     res.status(500).json({ error: 'MQTT Not Connected' });
  }
});

// WebSockets Connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});

// Start MQTT, Automation Engine, and Discovery
require('./mqttClient')(io);
require('./automationEngine')(io);
discovery.startDiscovery(io);
