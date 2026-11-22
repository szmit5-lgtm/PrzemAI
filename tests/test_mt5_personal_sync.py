"""Safety checks for the opt-in MT5 sync bridge, without network or MT5."""
import importlib.util
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

path = Path(__file__).resolve().parents[1] / "scripts" / "mt5_personal_sync.py"
spec = importlib.util.spec_from_file_location("mt5_personal_sync", path)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class Response:
    status = 200
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self): return b"{}"


SNAPSHOT = {
    "source": "MT5_LOCAL", "mode": "REAL", "readOnly": True,
    "asOf": "2026-11-22T20:00:00+00:00", "currency": "EUR",
    "balance": 3.24, "equity": 3.24, "positionCount": 0, "positions": []
}


class SyncTests(unittest.TestCase):
    def test_rejects_http_and_missing_token(self):
        with patch.dict(os.environ, {"PRZEMAI_MT5_API_URL": "http://localhost",
                                      "PRZEMAI_MT5_JWT": "token"}):
            with self.assertRaises(ValueError):
                sync.run(json.dumps(SNAPSHOT), opener=lambda *_a, **_kw: self.fail("network called"))

    def test_sync_posts_only_personal_endpoint(self):
        requests = []
        def opener(req, **_):
            requests.append(req)
            return Response()
        with patch.dict(os.environ, {
            "PRZEMAI_MT5_API_URL": "https://example.com",
            "PRZEMAI_MT5_JWT": "test-jwt",
            "PRZEMAI_MT5_TELEGRAM_BOT_TOKEN": "",
            "PRZEMAI_MT5_TELEGRAM_CHAT_ID": ""
        }):
            self.assertTrue(sync.run(json.dumps(SNAPSHOT), opener=opener))
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0].full_url, "https://example.com/api/mt5/personal/snapshots")
        self.assertNotIn(b"organizationId", requests[0].data)

    def test_rejects_non_real_account(self):
        with patch.dict(os.environ, {"PRZEMAI_MT5_API_URL": "https://example.com",
                                      "PRZEMAI_MT5_JWT": "token"}):
            with self.assertRaises(ValueError):
                sync.run(json.dumps({**SNAPSHOT, "mode": "DEMO"}),
                         opener=lambda *_a, **_kw: self.fail("network called"))


if __name__ == "__main__":
    unittest.main()
