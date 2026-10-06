const db = require('./db');

module.exports = function(io) {
  const mqttClientModule = require('./mqttClient');
  
  const sendCommand = (boardId, payload) => {
     if (mqttClientModule.client && mqttClientModule.client.connected) {
         mqttClientModule.client.publish(`home/${boardId}/command`, JSON.stringify(payload));
     }
  };

  const evaluateCondition = (type, time, sensorType, condition, value, currentTimeString, latestTelemetry) => {
    if (type === 'time' && time) {
      return time === currentTimeString;
    } else if (type === 'sensor' && sensorType && latestTelemetry) {
      let sensorValue;
      if (sensorType === 'temperature') sensorValue = latestTelemetry.temperature;
      if (sensorType === 'humidity') sensorValue = latestTelemetry.humidity;
      if (sensorType === 'power') sensorValue = latestTelemetry.powerUsage;

      if (sensorValue !== undefined && condition && value !== undefined && value !== null) {
         if (condition === '>') return sensorValue > value;
         if (condition === '<') return sensorValue < value;
         if (condition === '==') return sensorValue === value;
      }
    }
    return false;
  };

  // Run evaluation every 30 seconds
  setInterval(() => {
    try {
      const automations = db.prepare('SELECT * FROM automations WHERE enabled = 1').all();
      if (automations.length === 0) return;

      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMinute = now.getMinutes().toString().padStart(2, '0');
      const currentTimeString = `${currentHour}:${currentMinute}`;
      
      const latestTelemetry = db.prepare('SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 1').get();

      automations.forEach(rule => {
        
        const primaryTrue = evaluateCondition(rule.triggerType, rule.triggerTime, rule.triggerSensorType, rule.triggerCondition, rule.triggerValue, currentTimeString, latestTelemetry);
        
        let shouldTrigger = false;

        if (rule.logicOperator === 'AND' || rule.logicOperator === 'OR') {
            const secondaryTrue = evaluateCondition('sensor', null, rule.secondarySensorType, rule.secondaryCondition, rule.secondaryValue, currentTimeString, latestTelemetry);
            
            if (rule.logicOperator === 'AND') {
                shouldTrigger = primaryTrue && secondaryTrue;
            } else if (rule.logicOperator === 'OR') {
                shouldTrigger = primaryTrue || secondaryTrue;
            }
        } else {
            shouldTrigger = primaryTrue;
        }

        if (shouldTrigger) {
          // Check if device is already in target state
          const targetDevice = db.prepare('SELECT * FROM devices WHERE id = ? AND boardId = ?').get(rule.actionDeviceId, rule.actionBoardId);
          const actionStateNum = rule.actionState === 'ON' ? 1 : 0;
          
          if (targetDevice && targetDevice.state !== actionStateNum) {
             // Execute Action
             if (rule.actionState === 'ON' || rule.actionState === 'OFF') {
                 sendCommand(rule.actionBoardId, { type: "toggle", id: targetDevice.id });
             }
             
             // Log execution
             db.prepare('INSERT INTO activity_logs (message) VALUES (?)').run(`تم تنفيذ الأتمتة المتقدمة: ${rule.name}`);
             io.emit('logs_updated', db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100').all());
          }
        }
      });
    } catch (err) {
      console.error("Automation Engine Error:", err);
    }
  }, 30000); // 30 seconds
};
