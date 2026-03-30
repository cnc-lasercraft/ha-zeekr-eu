"""
Zeekr EV API Client.

Based on zeekr_ev_api by @Fryyyyy (MIT License).
https://github.com/Fryyyyy/zeekr_homeassistant
"""

from .client import ZeekrClient
from .exceptions import AuthException, ZeekrException

__all__ = ["ZeekrClient", "ZeekrException", "AuthException"]
