"""Offline tests: no broker connection or real account required."""
import importlib.util
import pathlib
import unittest
from types import SimpleNamespace as NS

PATH = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "mt5_real_readonly_snapshot.py"
spec = importlib.util.spec_from_file_location("mt5_real_readonly_snapshot", PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FakeMT5:
    ACCOUNT_TRADE_MODE_REAL = 2
    POSITION_TYPE_BUY = 0
    POSITION_TYPE_SELL = 1

    def __init__(self, mode=2, positions=()):
        self.mode = mode
        self.positions = positions
        self.closed = False

    def initialize(self):
        return True

    def terminal_info(self):
        return NS(connected=True)

    def account_info(self):
        return NS(trade_mode=self.mode, currency="EUR", balance=3.24, equity=3.24)

    def positions_get(self):
        return self.positions

    def shutdown(self):
        self.closed = True


class RealReadOnlyTests(unittest.TestCase):
    def test_real_account_no_positions(self):
        api = FakeMT5()
        result = module.snapshot_real_readonly(api)
        self.assertEqual(result["mode"], "REAL")
        self.assertEqual(result["positionCount"], 0)
        self.assertEqual(result["balance"], 3.24)
        self.assertNotIn("login", result)
        self.assertNotIn("password", result)
        self.assertTrue(api.closed)

    def test_reject_demo(self):
        api = FakeMT5(mode=0)
        with self.assertRaises(PermissionError):
            module.snapshot_real_readonly(api)
        self.assertTrue(api.closed)

    def test_invalid_position_rejected(self):
        p = NS(symbol="EURUSD", type=0, volume=float("nan"),
               price_open=1.0, price_current=1.1, profit=0.0)
        api = FakeMT5(positions=[p])
        with self.assertRaises(ValueError):
            module.snapshot_real_readonly(api)
        self.assertTrue(api.closed)

    def test_no_order_methods_in_module(self):
        source = PATH.read_text(encoding="utf-8")
        self.assertNotIn("order_send", source)
        self.assertNotIn("order_check", source)


if __name__ == "__main__":
    unittest.main()
