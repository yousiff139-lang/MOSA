import * as protobuf from 'protobufjs';
import path from 'path';

let telemetryType: protobuf.Type;

export const initProtobuf = async () => {
  const root = await protobuf.load(path.join(__dirname, '../proto/telemetry.proto'));
  telemetryType = root.lookupType('mosa.DeviceTelemetry');
  console.log('✅ Protobuf Schema Loaded Successfully');
};

export const encodeTelemetry = (payload: object): Buffer => {
  const message = telemetryType.create(payload);
  return Buffer.from(telemetryType.encode(message).finish());
};

export const decodeTelemetry = (buffer: Buffer): object => {
  const message = telemetryType.decode(buffer);
  return telemetryType.toObject(message, {
    longs: String,
    enums: String,
    bytes: String,
  });
};
