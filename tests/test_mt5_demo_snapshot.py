"""Offline synthetic tests: never access a broker or a real terminal."""
import json
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from scripts.mt5_demo_snapshot import build_demo_snapshot


class FakeMT5:
    ACCOUNT_TRADE_MODE_DEMO = 0
    POSITION_TYPE_BUY = 0
    POSITION_TYPE_SELL = 1

    def __init__(self, trade_mode=0, connected=True, positions=None):
        self.trade_mode = trade_mode
        self.connected = connected
        self.initialized = 0
        self.shutdowns = 0
        self.position_reads = 0
        self._positions = positions if positions is not None else [
            SimpleNamespace(symbol="EURUSD", type=0, volume=0.10,
                            price_open=1.08, price_current=1.085,
                            profit=5.25, swap=-0.18, comment="PRIVATE")
        ]

    def initialize(self):
        self.initialized += 1
        return True

    def shutdown(self):
        self.shutdowns += 1

    def terminal_info(self):
        return SimpleNamespace(connected=self.connected)

    def account_info(self):
        return SimpleNamespace(trade_mode=self.trade_mode, currency="PLN",
                               balance=10000, equity=10005.25, margin=50,
                               margin_free=9955.25, profit=5.25,
                               login=123456789, name="PRIVATE NAME",
                               server="PRIVATE SERVER")

    def positions_get(self):
        self.position_reads += 1
        return self._positions


class SnapshotTests(unittest.TestCase):
    def test_demo_read_only_snapshot_excludes_account_personal_data(self):
        fake = FakeMT5()
        result = build_demo_snapshot(fake, now=datetime(2026, 11, 15, tzinfo=timezone.utc))
        self.assertEqual(result["mode"], "DEMO")
        self.assertTrue(result["readOnly"])
        self.assertEqual(result["currency"], "PLN")
        self.assertEqual(result["positionCount"], 1)
        self.assertEqual(result["positions"][0]["unrealizedPnl"], 5.25)
        payload = json.dumps(result)
        for secret in ("PRIVATE", "123456789", "login", "server", "comment", "password"):
            self.assertNotIn(secret, payload)
        self.assertEqual(fake.shutdowns, 1)

    def test_refuses_real_account_before_position_reads(self):
        fake = FakeMT5(trade_mode=2)
        with self.assertRaisesRegex(PermissionError, "mt5_demo_only"):
            build_demo_snapshot(fake)
        self.assertEqual(fake.position_reads, 0)
        self.assertEqual(fake.shutdowns, 1)

    def test_refuses_disconnected_terminal_and_closes_connection(self):
        fake = FakeMT5(connected=False)
        with self.assertRaisesRegex(RuntimeError, "mt5_terminal_not_connected"):
            build_demo_snapshot(fake)
        self.assertEqual(fake.shutdowns, 1)

    def test_invalid_position_fails_closed_and_closes_connection(self):
        fake = FakeMT5(positions=[SimpleNamespace(
            symbol="EURUSD", type=0, volume=float("nan"),
            price_open=1.0, price_current=1.0, profit=1, swap=0)])
        with self.assertRaisesRegex(ValueError, "mt5_invalid_volume"):
            build_demo_snapshot(fake)
        self.assertEqual(fake.shutdowns, 1)

    def test_rejects_large_unbounded_response(self):
        pos = SimpleNamespace(symbol="EURUSD", type=0, volume=0.01,
                              price_open=1.0, price_current=1.0, profit=0.0, swap=0.0)
        fake = FakeMT5(positions=[pos] * 201)
        with self.assertRaisesRegex(RuntimeError, "mt5_positions_limit_exceeded"):
            build_demo_snapshot(fake)
        self.assertEqual(fake.shutdowns, 1)


    def test_unavailable_positions_fail_closed_and_close_terminal(self):
        fake = FakeMT5()
        fake._positions = None
        with self.assertRaisesRegex(RuntimeError, "mt5_positions_unavailable"):
            build_demo_snapshot(fake)
        self.assertEqual(fake.position_reads, 1)
        self.assertEqual(fake.shutdowns, 1)

    def test_invalid_currency_never_reads_positions(self):
        fake = FakeMT5()
        original = fake.account_info
        def invalid_account():
            account = original()
            account.currency = "PLN-PRIVATE"
            return account
        fake.account_info = invalid_account
        with self.assertRaisesRegex(ValueError, "mt5_invalid_currency"):
            build_demo_snapshot(fake)
        self.assertEqual(fake.position_reads, 0)
        self.assertEqual(fake.shutdowns, 1)

    def test_rejects_zero_and_negative_prices_and_closes_terminal(self):
        for field, bad in (("price_open", 0), ("price_current", -1)):
            with self.subTest(field=field):
                position = SimpleNamespace(symbol="EURUSD", type=0, volume=0.1,
                                           price_open=1.08, price_current=1.09,
                                           profit=0, swap=0)
                setattr(position, field, bad)
                fake = FakeMT5(positions=[position])
                with self.assertRaisesRegex(ValueError, "mt5_invalid_price"):
                    build_demo_snapshot(fake)
                self.assertEqual(fake.shutdowns, 1)

if __name__ == "__main__":
    unittest.main()
