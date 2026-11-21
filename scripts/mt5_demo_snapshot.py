"""Read-only snapshot of a locally logged-in MetaTrader 5 DEMO terminal.

No order placement, password loading, account identifiers or network sync to PrzemAI.
Run only on the account owner's local Windows machine.
"""
from __future__ import annotations

import json
import math
import re
import sys
from datetime import datetime, timezone

MAX_POSITIONS = 200
SYMBOL_RE = re.compile(r"^[A-Za-z0-9._#-]{1,40}$")


def _safe_number(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("mt5_invalid_" + name)
    return float(value)


def build_demo_snapshot(mt5, *, now=None):
    """Return only non-PII DEMO account metrics using an injected MT5 API adapter.

    The injected API allows offline synthetic unit tests without MT5 installed.
    """
    if not mt5.initialize():
        raise RuntimeError("mt5_initialize_failed")
    try:
        terminal = mt5.terminal_info()
        if terminal is None or terminal.connected is not True:
            raise RuntimeError("mt5_terminal_not_connected")
        account = mt5.account_info()
        if account is None:
            raise RuntimeError("mt5_account_unavailable")
        if account.trade_mode != mt5.ACCOUNT_TRADE_MODE_DEMO:
            raise PermissionError("mt5_demo_only")
        currency = account.currency
        if not isinstance(currency, str) or not re.fullmatch(r"[A-Z]{3}", currency):
            raise ValueError("mt5_invalid_currency")
        positions = mt5.positions_get()
        if positions is None:
            raise RuntimeError("mt5_positions_unavailable")
        if len(positions) > MAX_POSITIONS:
            raise RuntimeError("mt5_positions_limit_exceeded")
        sanitized = []
        for position in positions:
            if not isinstance(position.symbol, str) or not SYMBOL_RE.fullmatch(position.symbol):
                raise ValueError("mt5_invalid_symbol")
            if isinstance(position.type, bool) or not isinstance(position.type, int) or position.type not in (mt5.POSITION_TYPE_BUY, mt5.POSITION_TYPE_SELL):
                raise ValueError("mt5_invalid_position_type")
            volume = _safe_number(position.volume, "volume")
            if volume <= 0:
                raise ValueError("mt5_invalid_volume")
            entry_price = _safe_number(position.price_open, "entry_price")
            current_price = _safe_number(position.price_current, "current_price")
            if entry_price <= 0 or current_price <= 0:
                raise ValueError("mt5_invalid_price")
            sanitized.append({
                "symbol": position.symbol,
                "side": "buy" if position.type == mt5.POSITION_TYPE_BUY else "sell",
                "volumeLots": volume,
                "entryPrice": entry_price,
                "currentPrice": current_price,
                "unrealizedPnl": _safe_number(position.profit, "position_profit"),
                "swap": _safe_number(position.swap, "swap"),
            })
        timestamp = datetime.now(timezone.utc) if now is None else now
        if timestamp.tzinfo is None:
            raise ValueError("mt5_invalid_timestamp")
        return {
            "source": "MT5_LOCAL",
            "mode": "DEMO",
            "readOnly": True,
            "asOf": timestamp.astimezone(timezone.utc).isoformat(),
            "currency": currency,
            "balance": _safe_number(account.balance, "balance"),
            "equity": _safe_number(account.equity, "equity"),
            "usedMargin": _safe_number(account.margin, "margin"),
            "freeMargin": _safe_number(account.margin_free, "margin_free"),
            "unrealizedPnl": _safe_number(account.profit, "account_profit"),
            "positionCount": len(sanitized),
            "positions": sanitized,
        }
    finally:
        mt5.shutdown()


def main():
    try:
        import MetaTrader5 as mt5
    except ImportError:
        print("mt5_not_installed", file=sys.stderr)
        return 2
    try:
        snapshot = build_demo_snapshot(mt5)
    except (RuntimeError, PermissionError, ValueError, AttributeError):
        # Do not print raw broker errors, account information or credentials.
        print("mt5_snapshot_failed_or_not_demo", file=sys.stderr)
        return 1
    print(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"), allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
