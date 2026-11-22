"""Opt-in local MT5 -> personal PrzemAI API sync; optional private Telegram report.

Runs only when explicitly invoked on the Windows machine hosting MT5.
Secrets are read from environment and never printed or written to disk.
No trading API is used. No organization context is sent.
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SCRIPT = Path(__file__).with_name("mt5_real_readonly_snapshot.py")


def post_json(url, data, headers=None, opener=urllib.request.urlopen):
    payload = json.dumps(data, separators=(",", ":"), allow_nan=False).encode("utf-8")
    request = urllib.request.Request(
        url, data=payload, method="POST",
        headers={"Content-Type": "application/json", **(headers or {})})
    with opener(request, timeout=15) as response:
        if response.status not in (200, 201):
            raise RuntimeError("remote_request_failed")
        return response.read()


def run(snapshot_json=None, opener=urllib.request.urlopen):
    base = os.environ.get("PRZEMAI_MT5_API_URL", "").rstrip("/")
    token = os.environ.get("PRZEMAI_MT5_JWT", "")
    if not base.startswith("https://") or not token or any(c.isspace() for c in token):
        raise ValueError("secure_api_configuration_required")
    if snapshot_json is None:
        process = subprocess.run(
            [sys.executable, str(SCRIPT)], capture_output=True, text=True,
            timeout=30, check=False)
        if process.returncode != 0:
            raise RuntimeError("local_mt5_snapshot_failed")
        snapshot_json = process.stdout
    snapshot = json.loads(snapshot_json)
    if snapshot.get("mode") != "REAL" or snapshot.get("readOnly") is not True:
        raise ValueError("readonly_real_snapshot_required")
    post_json(base + "/api/mt5/personal/snapshots", snapshot,
              {"Authorization": "Bearer " + token}, opener=opener)

    # Optional, private Telegram destination; disabled by default.
    bot_token = os.environ.get("PRZEMAI_MT5_TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("PRZEMAI_MT5_TELEGRAM_CHAT_ID", "")
    if bool(bot_token) != bool(chat_id):
        raise ValueError("telegram_configuration_incomplete")
    if bot_token and chat_id:
        if not chat_id.lstrip("-").isdigit():
            raise ValueError("telegram_chat_id_invalid")
        message = (
            "PrzemAI | MT5 REAL (tylko odczyt)\\n"
            f"Saldo: {snapshot['balance']:.2f} {snapshot['currency']}\\n"
            f"Kapitał: {snapshot['equity']:.2f} {snapshot['currency']}\\n"
            f"Otwarte pozycje: {snapshot['positionCount']}\\n"
            f"Stan na: {snapshot['asOf']}")
        post_json("https://api.telegram.org/bot" + bot_token + "/sendMessage",
                  {"chat_id": chat_id, "text": message}, opener=opener)
    return True


if __name__ == "__main__":
    try:
        run()
        print("mt5_personal_sync_ok")
    except (ValueError, RuntimeError, OSError, KeyError, TypeError,
            urllib.error.URLError, json.JSONDecodeError, subprocess.TimeoutExpired):
        print("mt5_personal_sync_failed", file=sys.stderr)
        sys.exit(1)
