"""Synthetic MT5 account-metric validation; no broker or terminal access."""
import unittest
from types import SimpleNamespace
from scripts.mt5_demo_snapshot import build_demo_snapshot
class FakeMT5:
    ACCOUNT_TRADE_MODE_DEMO = 0
    POSITION_TYPE_BUY = 0
    POSITION_TYPE_SELL = 1

    def __init__(self):
        self.shutdowns = 0

    def initialize(self):
        return True

    def shutdown(self):
        self.shutdowns += 1

    def terminal_info(self):
        return SimpleNamespace(connected=True)

    def account_info(self):
        return SimpleNamespace(trade_mode=0, currency='PLN', balance=1000.0,
                               equity=1000.0, margin=0.0, margin_free=1000.0,
                               profit=0.0)

    def positions_get(self):
        return []


class AccountMetricTests(unittest.TestCase):
    def test_rejects_nonfinite_balance_and_closes_terminal(self):
        fake = FakeMT5()
        original = fake.account_info

        def account():
            data = original()
            data.balance = float('nan')
            return data

        fake.account_info = account
        with self.assertRaisesRegex(ValueError, 'mt5_invalid_balance'):
            build_demo_snapshot(fake)
        self.assertEqual(fake.shutdowns, 1)

    def test_rejects_boolean_equity_and_closes_terminal(self):
        fake = FakeMT5()
        original = fake.account_info

        def account():
            data = original()
            data.equity = True
            return data

        fake.account_info = account
        with self.assertRaisesRegex(ValueError, 'mt5_invalid_equity'):
            build_demo_snapshot(fake)
        self.assertEqual(fake.shutdowns, 1)

    def test_rejects_real_account_before_reading_positions_and_closes_terminal(self):
        fake = FakeMT5()
        original = fake.account_info
        reads = []

        def account():
            data = original()
            data.trade_mode = 2
            return data

        def positions():
            reads.append('positions_get')
            raise AssertionError('real account positions must not be accessed')

        fake.account_info = account
        fake.positions_get = positions
        with self.assertRaisesRegex(PermissionError, 'mt5_demo_only'):
            build_demo_snapshot(fake)
        self.assertEqual(reads, [])
        self.assertEqual(fake.shutdowns, 1)


if __name__ == '__main__':
    unittest.main()
