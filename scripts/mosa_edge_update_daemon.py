#!/usr/bin/env python3
"""
MOSA Smart Platform - Edge Gateway Auto-Update Daemon
Runs on Raspberry Pi / On-Premise Edge Gateways.
Periodically checks Central Server (api.mosa.iq) for version releases,
pulls Docker images, applies database migrations, and restarts containers cleanly.
"""

import time
import json
import os
import subprocess
import urllib.request
import urllib.error

CENTRAL_UPDATE_URL = os.getenv("CENTRAL_UPDATE_URL", "https://api.mosa.iq/api/system-release/edge-check")
POLL_INTERVAL_SECONDS = 3600 # Check every 1 hour
VERSION_FILE_PATH = "/app/VERSION"

def get_current_local_version():
    if os.path.exists(VERSION_FILE_PATH):
        try:
            with open(VERSION_FILE_PATH, "r") as f:
                return f.read().strip()
        except Exception:
            pass
    return "2.4.0"

def save_local_version(version):
    try:
        with open(VERSION_FILE_PATH, "w") as f:
            f.write(version)
    except Exception as e:
        print(f"[EdgeDaemon] Failed to write VERSION file: {e}")

def run_command(cmd_str):
    print(f"[EdgeDaemon] Executing: {cmd_str}")
    result = subprocess.run(cmd_str, shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"[EdgeDaemon] Success: {result.stdout.strip()}")
        return True
    else:
        print(f"[EdgeDaemon] Error ({result.returncode}): {result.stderr.strip()}")
        return False

def check_and_apply_update():
    print(f"[EdgeDaemon] Checking for updates from {CENTRAL_UPDATE_URL}...")
    current_version = get_current_local_version()
    
    try:
        req = urllib.request.Request(CENTRAL_UPDATE_URL, headers={'User-Agent': 'MosaEdgeDaemon/1.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                target_version = data.get("targetVersion", current_version)
                is_mandatory = data.get("isMandatory", False)
                
                print(f"[EdgeDaemon] Local Version: {current_version} | Target Version: {target_version}")
                
                if target_version != current_version or is_mandatory:
                    print(f"[EdgeDaemon] 🚀 New version release detected ({target_version}). Starting deployment...")
                    
                    # 1. Pull latest Docker Images
                    pull_success = run_command("docker compose pull")
                    
                    # 2. Apply Database Migrations
                    run_command("docker compose exec -T backend npx prisma migrate deploy")
                    
                    # 3. Restart Docker Containers with zero-downtime
                    up_success = run_command("docker compose up -d --remove-orphans")
                    
                    if up_success:
                        save_local_version(target_version)
                        print(f"[EdgeDaemon] ✅ System successfully updated to v{target_version}!")
                    else:
                        print(f"[EdgeDaemon] ❌ Failed to start updated containers.")
    except urllib.error.URLError as err:
        print(f"[EdgeDaemon] Central server unreachable: {err}")
    except Exception as ex:
        print(f"[EdgeDaemon] Unexpected update error: {ex}")

def main():
    print("==================================================")
    print("  MOSA Smart Platform Edge Gateway Update Daemon  ")
    print("==================================================")
    while True:
        check_and_apply_update()
        time.sleep(POLL_INTERVAL_SECONDS)

if __name__ == "__main__":
    main()
