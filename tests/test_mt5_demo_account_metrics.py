"""Synthetic MT5 account-metric validation; no broker or terminal access."""
import unittest
from types import SimpleNamespace
from scripts.mt5_demo_snapshot import build_demo_snapshot
from tests.test_mt5_demo_snapshot import FakeMT5


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


if __name__ == '__main__':
    unittest.main()
