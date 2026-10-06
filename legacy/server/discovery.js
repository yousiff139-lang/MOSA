const { Bonjour } = require('bonjour-service');
const db = require('./db');

const bonjour = new Bonjour();
const discoveredDevices = new Map();

// Start browsing for mDNS services published by ESP32
function startDiscovery(io) {
    console.log('[Discovery] Browsing for MosaSmart devices...');
    
    // We look for _mosasmart._tcp
    const browser = bonjour.find({ type: 'mosasmart' });

    browser.on('up', (service) => {
        console.log('[Discovery] Found service:', service.name);
        
        // Extract info from TXT records and service object
        // TXT records are usually buffered, so we convert them if needed
        let boardId = service.name; // default to service name if txt is missing
        let boardName = "New Board";
        
        if (service.txt) {
            if (service.txt.boardId) boardId = service.txt.boardId;
            if (service.txt.name) boardName = service.txt.name;
        }

        // Service provides array of IP addresses
        const ip = service.addresses && service.addresses.length > 0 ? service.addresses[0] : null;

        if (ip && boardId) {
            const deviceInfo = {
                id: boardId,
                name: boardName,
                ip: ip,
                lastSeen: Date.now()
            };
            
            discoveredDevices.set(boardId, deviceInfo);

            // Auto-add or update in database
            const isNew = !db.prepare('SELECT id FROM boards WHERE id = ?').get(boardId);
            db.prepare('INSERT OR REPLACE INTO boards (id, name, ip) VALUES (?, ?, ?)').run(boardId, boardName, ip);
            console.log(`[Discovery] Auto-registered Board: ${boardName} (${boardId}) at ${ip}`);
            
            // Auto-Sync devices from the board
            fetch(`http://${ip}/api/sync?key=changeme123`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.devices) {
                        data.devices.forEach(dev => {
                            const stateNum = dev.state === 'ON' ? 1 : 0;
                            const existingDev = db.prepare('SELECT id FROM devices WHERE id = ? AND boardId = ?').get(dev.id, boardId);
                            if (existingDev) {
                                db.prepare(`UPDATE devices SET name=?, room=?, type=?, pin=?, inPin=?, state=?, pwmValue=?, color=? WHERE id=? AND boardId=?`)
                                  .run(dev.name, dev.room, dev.type, dev.pin, dev.inPin, stateNum, dev.pwmValue || 255, dev.color || '#ffffff', dev.id, boardId);
                            } else {
                                db.prepare(`INSERT INTO devices (id, boardId, name, room, type, pin, inPin, state, pwmValue, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                                  .run(dev.id, boardId, dev.name, dev.room, dev.type, dev.pin, dev.inPin, stateNum, dev.pwmValue || 255, dev.color || '#ffffff');
                            }
                        });
                    }
                    
                    if (io) {
                        io.emit('boards_updated', db.prepare('SELECT * FROM boards').all());
                        io.emit('devices_updated', db.prepare('SELECT * FROM devices').all());
                        io.emit('board_status_change', { boardId: boardId, online: true });
                        if (isNew) {
                            io.emit('new_board_discovered', { id: boardId, name: boardName, ip: ip });
                        }
                    }
                })
                .catch(err => {
                    console.error('[Discovery] Sync failed for', boardId, err.message);
                    if (io) {
                        io.emit('boards_updated', db.prepare('SELECT * FROM boards').all());
                        io.emit('board_status_change', { boardId: boardId, online: true });
                        if (isNew) io.emit('new_board_discovered', { id: boardId, name: boardName, ip: ip });
                    }
                });
        }
    });

    browser.on('down', (service) => {
        console.log('[Discovery] Service went down:', service.name);
    });
}

function getDiscoveredDevices() {
    // Return array of recently seen devices (e.g. seen in last 5 minutes)
    const now = Date.now();
    const active = [];
    for (const [id, device] of discoveredDevices.entries()) {
        if (now - device.lastSeen < 5 * 60 * 1000) {
            active.push(device);
        } else {
            discoveredDevices.delete(id);
        }
    }
    return active;
}

module.exports = {
    startDiscovery,
    getDiscoveredDevices
};
