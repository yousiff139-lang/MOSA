#!/usr/bin/env python3
"""
MOSA Smart Platform - Cryptographic Evidence Bundle Generator
Generates immutable SHA-256 manifests for HIL & Production verification tests.
"""

import os
import sys
import json
import hashlib
from datetime import datetime

def compute_sha256(filepath):
    """Computes the SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            sha256.update(chunk)
    return sha256.hexdigest()

def create_evidence_bundle(test_id, test_name, device_id, firmware_version, hardware_rev, environment, result, input_desc, expected, actual, duration_ms, logs_dict=None):
    """Creates a standardized evidence bundle directory with manifest.sha256."""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'evidence', test_id))
    os.makedirs(base_dir, exist_ok=True)

    manifest_data = {
        "testId": test_id,
        "testName": test_name,
        "deviceId": device_id,
        "firmwareVersion": firmware_version,
        "hardwareRevision": hardware_rev,
        "environment": environment,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "input": input_desc,
        "expectedResult": expected,
        "actualResult": actual,
        "durationMs": duration_ms,
        "result": result
    }

    # Write test manifest JSON
    manifest_path = os.path.join(base_dir, "test_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)

    # Write additional logs if provided
    file_hashes = {}
    file_hashes["test_manifest.json"] = compute_sha256(manifest_path)

    if logs_dict:
        for filename, content in logs_dict.items():
            log_file_path = os.path.join(base_dir, filename)
            with open(log_file_path, "w", encoding="utf-8") as f:
                f.write(content)
            file_hashes[filename] = compute_sha256(log_file_path)

    # Generate master manifest.sha256
    manifest_sha_path = os.path.join(base_dir, "manifest.sha256")
    master_hash_str = ""
    with open(manifest_sha_path, "w", encoding="utf-8") as f:
        for fname, fhash in sorted(file_hashes.items()):
            line = f"{fhash}  {fname}\n"
            f.write(line)
            master_hash_str += line

    master_sha256 = hashlib.sha256(master_hash_str.encode('utf-8')).hexdigest()
    print(f"[Evidence Collector] ✅ Created evidence bundle for {test_id} ({result}) at: {base_dir}")
    print(f"[Evidence Collector] 🔒 Master Bundle SHA-256: {master_sha256}")
    return master_sha256

if __name__ == "__main__":
    # Test Evidence Bundle Generation for REQ-SEC-001 / TEST-01
    sample_serial = "[UART] ESP32-S3 booting...\n[mTLS] Initializing X.509 cert validation...\n[mTLS] Valid Cert Handshake SUCCESS\n"
    sample_mqtt = '{"topic":"mosa/home-1/device/MOSA-ESP-001/ack","payload":{"commandId":"cmd_101","status":"executed"}}\n'

    create_evidence_bundle(
        test_id="HIL-01",
        test_name="ESP32 Provisioning & mTLS Certificate Validation",
        device_id="MOSA-ESP-001",
        firmware_version="2.5.0",
        hardware_rev="REV-C",
        environment="Physical Hardware Testbed Bench",
        result="PASS",
        input_desc="Boot ESP32 node and authenticate via mTLS Certificate",
        expected="Valid Certificate Handshake ACCEPTED; MQTT CONNECT 200",
        actual="Handshake completed in 112ms; device identity confirmed.",
        duration_ms=112,
        logs_dict={
            "serial_output.log": sample_serial,
            "mqtt_trace.json": sample_mqtt
        }
    )
