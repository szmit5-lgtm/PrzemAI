"""Local read-only MT5 REAL snapshot. No credentials, account IDs, orders or upload.

This module does not connect to PrzemAI. Synchronization must be implemented
separately with authenticated owner-only tenancy and explicit opt-in.
"""
import json
import math
import re
import sys
from datetime import datetime, timezone

_CURRENCY = re.compile(r"^[A-Z]{3}$")
_SYMBOL = re.compile(r"^[A-Za-z0-9._#-]{1,40}$")
MAX_POSITIONS = 200


def finite_number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("invalid_number")
    if not math.isfinite(value):
        raise ValueError("invalid_number")
    return float(value)


def snapshot_real_readonly(mt5, *, now=None):
    if not mt5.initialize():
        raise RuntimeError("mt5_initialize_failed")
    try:
        terminal = mt5.terminal_info()
        if terminal is None or terminal.connected is not True:
            raise RuntimeError("mt5_terminal_disconnected")
        account = mt5.account_info()
        if account is None or account.trade_mode != mt5.ACCOUNT_TRADE_MODE_REAL:
            raise PermissionError("mt5_real_account_required")
        if not isinstance(account.currency, str) or not _CURRENCY.fullmatch(account.currency):
            raise ValueError("invalid_currency")
        positions = mt5.positions_get()
        if positions is None or len(positions) > MAX_POSITIONS:
            raise RuntimeError("mt5_positions_unavailable")
        clean = []
        for p in positions:
            if not isinstance(p.symbol, str) or not _SYMBOL.fullmatch(p.symbol):
                raise ValueError("invalid_symbol")
            if p.type not in (mt5.POSITION_TYPE_BUY, mt5.POSITION_TYPE_SELL):
                raise ValueError("invalid_side")
            volume = finite_number(p.volume)
            if volume <= 0:
                raise ValueError("invalid_volume")
            clean.append({
                "symbol": p.symbol,
                "side": "buy" if p.type == mt5.POSITION_TYPE_BUY else "sell",
                "volumeLots": volume,
                "entryPrice": finite_number(p.price_open),
                "currentPrice": finite_number(p.price_current),
                "unrealizedPnl": finite_number(p.profit),
            })
        timestamp = datetime.now(timezone.utc) if now is None else now
        if timestamp.tzinfo is None:
            raise ValueError("invalid_timestamp")
        return {
            "source": "MT5_LOCAL",
            "mode": "REAL",
            "readOnly": True,
            "asOf": timestamp.astimezone(timezone.utc).isoformat(),
            "currency": account.currency,
            "balance": finite_number(account.balance),
            "equity": finite_number(account.equity),
            "positionCount": len(clean),
            "positions": clean,
        }
    finally:
        mt5.shutdown()


def main():
    try:
        import MetaTrader5 as mt5
        data = snapshot_real_readonly(mt5)
    except (ImportError, RuntimeError, PermissionError, ValueError, AttributeError):
        print("mt5_real_readonly_snapshot_failed", file=sys.stderr)
        return 1
    print(json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
