var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var _this = this;
var _a = require('@prisma/client'), PrismaClient = _a.PrismaClient, Role = _a.Role;
var bcrypt = require('bcryptjs');
var prisma = new PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var passwordHash, admin, home, floorPlan, livingRoom, bedroom, kitchen, node, devices, _a, _b, _c, index, d, device, e_1_1;
        var e_1, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    console.log('Starting seed...');
                    // Cleanup existing data in correct dependency order
                    console.log('Cleaning up existing data...');
                    return [4 /*yield*/, prisma.floorPlanDevice.deleteMany({})];
                case 1:
                    _e.sent();
                    return [4 /*yield*/, prisma.floorPlan.deleteMany({})];
                case 2:
                    _e.sent();
                    return [4 /*yield*/, prisma.device.deleteMany({})];
                case 3:
                    _e.sent();
                    return [4 /*yield*/, prisma.node.deleteMany({})];
                case 4:
                    _e.sent();
                    return [4 /*yield*/, prisma.roomAccess.deleteMany({})];
                case 5:
                    _e.sent();
                    return [4 /*yield*/, prisma.roomPermission.deleteMany({})];
                case 6:
                    _e.sent();
                    return [4 /*yield*/, prisma.devicePermission.deleteMany({})];
                case 7:
                    _e.sent();
                    return [4 /*yield*/, prisma.scenePermission.deleteMany({})];
                case 8:
                    _e.sent();
                    return [4 /*yield*/, prisma.room.deleteMany({})];
                case 9:
                    _e.sent();
                    return [4 /*yield*/, prisma.homeMember.deleteMany({})];
                case 10:
                    _e.sent();
                    return [4 /*yield*/, prisma.home.deleteMany({})];
                case 11:
                    _e.sent();
                    return [4 /*yield*/, prisma.user.deleteMany({})];
                case 12:
                    _e.sent();
                    return [4 /*yield*/, bcrypt.hash('1234', 10)];
                case 13:
                    passwordHash = _e.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: {
                                id: 'admin-1',
                                username: 'admin',
                                pinCode: passwordHash,
                                name: 'Sarah J.',
                                role: 'SUPER_OWNER',
                            },
                        })];
                case 14:
                    admin = _e.sent();
                    console.log('Admin user created:', admin.username);
                    return [4 /*yield*/, prisma.home.create({
                            data: {
                                id: 'home-1',
                                name: 'My Primary Home',
                                location: 'Baghdad',
                                ownerId: 'admin-1',
                            },
                        })];
                case 15:
                    home = _e.sent();
                    console.log('Home created:', home.name);
                    // 3. Create HomeMember for Admin
                    return [4 /*yield*/, prisma.homeMember.create({
                            data: {
                                id: 'hm-1',
                                homeId: 'home-1',
                                userId: 'admin-1',
                                role: Role.SUPER_OWNER,
                            }
                        })];
                case 16:
                    // 3. Create HomeMember for Admin
                    _e.sent();
                    console.log('Home member role set to SUPER_OWNER');
                    return [4 /*yield*/, prisma.floorPlan.create({
                            data: {
                                id: 'fp-1',
                                name: 'الطابق الأرضي',
                                homeId: 'home-1',
                            }
                        })];
                case 17:
                    floorPlan = _e.sent();
                    console.log('Floor plan created:', floorPlan.name);
                    return [4 /*yield*/, prisma.room.create({
                            data: {
                                id: 'room-living',
                                name: 'Living Room',
                                homeId: 'home-1',
                            }
                        })];
                case 18:
                    livingRoom = _e.sent();
                    return [4 /*yield*/, prisma.room.create({
                            data: {
                                id: 'room-bedroom',
                                name: 'Bedroom',
                                homeId: 'home-1',
                            }
                        })];
                case 19:
                    bedroom = _e.sent();
                    return [4 /*yield*/, prisma.room.create({
                            data: {
                                id: 'room-kitchen',
                                name: 'Kitchen',
                                homeId: 'home-1',
                            }
                        })];
                case 20:
                    kitchen = _e.sent();
                    console.log('Rooms created');
                    return [4 /*yield*/, prisma.node.create({
                            data: {
                                id: 'node-1',
                                mac: 'AA:BB:CC:DD:EE:FF',
                                ip: '192.168.1.100',
                                name: 'Smart Controller 1',
                                status: 'online',
                                protocol: 'WIFI',
                                homeId: 'home-1',
                            }
                        })];
                case 21:
                    node = _e.sent();
                    console.log('Node created:', node.name);
                    devices = [
                        { name: 'مصباح المعيشة 1', type: 'LIGHT', roomId: livingRoom.id, x: 150, y: 120 },
                        { name: 'مصباح المعيشة 2', type: 'LIGHT', roomId: livingRoom.id, x: 280, y: 120 },
                        { name: 'مصباح غرفة النوم', type: 'LIGHT', roomId: bedroom.id, x: 450, y: 180 },
                        { name: 'مصباح المطبخ', type: 'LIGHT', roomId: kitchen.id, x: 600, y: 250 },
                        { name: 'حساس الحرارة', type: 'SENSOR_TEMP', roomId: livingRoom.id, x: 200, y: 300 },
                        { name: 'حساس الحركة', type: 'SENSOR_MOTION', roomId: livingRoom.id, x: 520, y: 380 },
                    ];
                    _e.label = 22;
                case 22:
                    _e.trys.push([22, 28, 29, 30]);
                    _a = __values(devices.entries()), _b = _a.next();
                    _e.label = 23;
                case 23:
                    if (!!_b.done) return [3 /*break*/, 27];
                    _c = __read(_b.value, 2), index = _c[0], d = _c[1];
                    return [4 /*yield*/, prisma.device.create({
                            data: {
                                id: "dev-".concat(index),
                                name: d.name,
                                type: d.type.toLowerCase(),
                                pin: index,
                                nodeId: node.id,
                                roomId: d.roomId,
                                homeId: 'home-1',
                                state: { isOn: false },
                            }
                        })];
                case 24:
                    device = _e.sent();
                    return [4 /*yield*/, prisma.floorPlanDevice.create({
                            data: {
                                id: "fpd-".concat(index),
                                floorPlanId: floorPlan.id,
                                deviceId: device.id,
                                x: d.x,
                                y: d.y,
                            }
                        })];
                case 25:
                    _e.sent();
                    _e.label = 26;
                case 26:
                    _b = _a.next();
                    return [3 /*break*/, 23];
                case 27: return [3 /*break*/, 30];
                case 28:
                    e_1_1 = _e.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 30];
                case 29:
                    try {
                        if (_b && !_b.done && (_d = _a.return)) _d.call(_a);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 30:
                    console.log('Seed completed successfully!');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
