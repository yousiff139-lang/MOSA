const Database = require('better-sqlite3');
const path = require('path');

// Create or open the SQLite database
const dbPath = process.env.DB_PATH || path.join(__dirname, 'smarthome.db');
const db = new Database(dbPath);

// Ensure performance optimizations
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT,
    ip TEXT
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER,
    boardId TEXT,
    name TEXT,
    room TEXT,
    type TEXT,
    pin INTEGER,
    inPin INTEGER,
    state INTEGER DEFAULT 0,
    pwmValue INTEGER DEFAULT 255,
    color TEXT DEFAULT '#ffffff',
    orderIndex INTEGER DEFAULT 0,
    PRIMARY KEY (id, boardId),
    FOREIGN KEY (boardId) REFERENCES boards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    boardId TEXT,
    temperature REAL,
    humidity REAL,
    powerUsage REAL,
    totalKWh REAL
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    message TEXT
  );

  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    name TEXT,
    enabled INTEGER DEFAULT 1,
    triggerType TEXT,
    triggerTime TEXT,
    triggerSensorType TEXT,
    triggerCondition TEXT,
    triggerValue REAL,
    logicOperator TEXT DEFAULT 'NONE', 
    secondarySensorType TEXT,
    secondaryCondition TEXT,
    secondaryValue REAL,
    actionDeviceId INTEGER,
    actionBoardId TEXT,
    actionState TEXT
  );
`);

module.exports = db;
