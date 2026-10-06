const mqtt = require('mqtt');
const db = require('./db');

module.exports = function(io) {
  const mqttHost = process.env.MQTT_HOST || 'broker.hivemq.com';
  const mqttUser = process.env.MQTT_USER || '';
  const mqttPass = process.env.MQTT_PASS || '';
  
  const options = {
    clientId: 'mosa_server_' + Math.random().toString(16).substr(2, 8),
  };
  
  if (mqttUser) {
    options.username = mqttUser;
    options.password = mqttPass;
  }

  const client = mqtt.connect(`mqtt://${mqttHost}`, options);

  client.on('connect', () => {
    console.log(`Connected to MQTT Broker: ${mqttHost}`);
    // Subscribe to all Mosa nodes
    client.subscribe('home/+/state');
    client.subscribe('home/+/status');
    client.subscribe('home/+/alarm');
  });

  // Export client so automation engine can use it to publish commands
  module.exports.client = client;

  client.on('message', (topic, message) => {
    try {
      const payloadStr = message.toString();
      const topicParts = topic.split('/');
      const boardId = topicParts[1];
      const type = topicParts[2]; // state, status, alarm

      if (type === 'state') {
        const data = JSON.parse(payloadStr);
        if (data.type === 'state') {
          // Verify board exists (prevent unauthorized 'ghost' devices from random MQTT messages)
          const board = db.prepare('SELECT id FROM boards WHERE id = ?').get(boardId);
          if (!board) {
             console.log(`[MQTT] Ignored state from unregistered board: ${boardId}`);
             return;
          }

          // Update Board name if needed
          db.prepare('UPDATE boards SET name = ? WHERE id = ?').run(data.boardName || boardId, boardId);
          io.emit('boards_updated', db.prepare('SELECT * FROM boards').all());

          // Update Global Telemetry (throttle to avoid DB spam, maybe once every minute)
          if (data.currentTemp !== undefined) {
             const lastTelemetry = db.prepare('SELECT * FROM telemetry WHERE boardId = ? ORDER BY timestamp DESC LIMIT 1').get(boardId);
             
             // Insert if difference is significant or if 5 minutes passed (simplification: just insert if >1 diff or just insert)
             db.prepare(`INSERT INTO telemetry (boardId, temperature, humidity, powerUsage, totalKWh) VALUES (?, ?, ?, ?, ?)`)
               .run(boardId, data.currentTemp, data.currentHum, data.currentPower, data.totalKWh);
             
             // Emit telemetry to UI
             io.emit('telemetry_update', {
               boardId,
               currentTemp: data.currentTemp,
               currentHum: data.currentHum,
               currentPower: data.currentPower,
               totalKWh: data.totalKWh
             });
          }

          // Update Devices
          if (data.devices && Array.isArray(data.devices)) {
            data.devices.forEach(dev => {
              const stateNum = (dev.state === 'ON' || dev.state === 1 || dev.state === true) ? 1 : 0;
              const existing = db.prepare('SELECT id FROM devices WHERE id = ? AND boardId = ?').get(dev.id, boardId);
              if (existing) {
                db.prepare(`UPDATE devices SET state = ?, pwmValue = ?, color = ? WHERE id = ? AND boardId = ?`)
                  .run(stateNum, dev.pwmValue || 255, dev.color || '#ffffff', dev.id, boardId);
              } else {
                db.prepare(`INSERT INTO devices (id, boardId, name, room, type, pin, inPin, state, pwmValue, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                  .run(dev.id, boardId, dev.name, dev.room, dev.type, dev.pin, dev.inPin, stateNum, dev.pwmValue || 255, dev.color || '#ffffff');
              }
            });
            
            // Broadcast updated devices to UI
            io.emit('devices_updated', db.prepare('SELECT * FROM devices').all());
          }
        }
      } 
      else if (type === 'alarm') {
        const data = JSON.parse(payloadStr);
        if (data.type === 'alarm' && data.message === 'PIR_TRIGGERED') {
          const logMsg = `إنذار حركة من اللوحة: ${boardId}`;
          db.prepare('INSERT INTO activity_logs (message) VALUES (?)').run(logMsg);
          io.emit('logs_updated', db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100').all());
          io.emit('motion_alert', { boardId });
        }
      }
      else if (type === 'status') {
         // Online/Offline status
         const data = JSON.parse(payloadStr);
         console.log(`Board ${boardId} is ${data.online ? 'Online' : 'Offline'}`);
         io.emit('board_status_change', { boardId: boardId, online: data.online });
      }
      
    } catch (err) {
      console.error('MQTT Message Error:', err);
    }
  });
};
