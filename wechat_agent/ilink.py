"""Minimal client for the official WeChat iLink Bot API (ilinkai.weixin.qq.com).

Protocol mirrors Tencent's official `@tencent-weixin/openclaw-weixin` channel:

* ``POST ilink/bot/get_bot_qrcode?bot_type=3``  -> QR code for login
* ``GET  ilink/bot/get_qrcode_status?qrcode=..`` -> long-poll scan status / bot_token
* ``POST ilink/bot/getupdates``                  -> long-poll inbound messages
* ``POST ilink/bot/sendmessage``                 -> send a reply
* ``POST ilink/bot/getconfig`` / ``sendtyping``  -> "对方正在输入" indicator

All requests are JSON over HTTPS. Authenticated calls carry
``AuthorizationType: ilink_bot_token`` + ``Authorization: Bearer <bot_token>``.
"""

from __future__ import annotations

import base64
import logging
import re
import secrets
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

import requests

from . import __version__

log = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com"
DEFAULT_BOT_TYPE = "3"
ILINK_APP_ID = "bot"
STALE_TOKEN_ERRCODE = -14  # session expired: scan the QR code again

# proto enums
MSG_TYPE_USER = 1
MSG_TYPE_BOT = 2
MSG_STATE_FINISH = 2
ITEM_TEXT = 1
ITEM_IMAGE = 2
ITEM_VOICE = 3
ITEM_FILE = 4
ITEM_VIDEO = 5
TYPING = 1
TYPING_CANCEL = 2

_MEDIA_LABEL = {ITEM_IMAGE: "[图片]", ITEM_VOICE: "[语音]", ITEM_FILE: "[文件]", ITEM_VIDEO: "[视频]"}


class ILinkError(RuntimeError):
    def __init__(self, message: str, errcode: int | None = None):
        super().__init__(message)
        self.errcode = errcode


class SessionExpired(ILinkError):
    """Raised when the server returns errcode -14 (bot_token no longer valid)."""


def _client_version(version: str) -> int:
    parts = [int(p) if p.isdigit() else 0 for p in (version.split(".") + ["0", "0"])[:3]]
    return ((parts[0] & 0xFF) << 16) | ((parts[1] & 0xFF) << 8) | (parts[2] & 0xFF)


def _random_uin() -> str:
    """X-WECHAT-UIN: random uint32 -> decimal string -> base64."""
    return base64.b64encode(str(secrets.randbits(32)).encode()).decode()


# uint64 ids (message_id etc.) may exceed float precision; quote bare big ints before json parsing.
_BIG_INT = re.compile(r'(:\s*)(-?\d{16,})(?=\s*[,}\]])')


def _loads(text: str) -> dict[str, Any]:
    import json

    return json.loads(_BIG_INT.sub(r'\1"\2"', text)) if text.strip() else {}


@dataclass
class InboundMessage:
    from_user_id: str
    text: str
    context_token: str | None
    message_id: str | None = None
    group_id: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


def extract_text(msg: dict[str, Any]) -> str:
    """Flatten a WeixinMessage item_list to plain text (voice uses server ASR text)."""
    parts: list[str] = []
    for item in msg.get("item_list") or []:
        t = item.get("type")
        if t == ITEM_TEXT and (item.get("text_item") or {}).get("text") is not None:
            text = str(item["text_item"]["text"])
            ref = (item.get("ref_msg") or {})
            quoted = ((ref.get("message_item") or {}).get("text_item") or {}).get("text") or ref.get("title")
            if quoted:
                text = f"「引用: {quoted}」\n{text}"
            parts.append(text)
        elif t == ITEM_VOICE and (item.get("voice_item") or {}).get("text"):
            parts.append(item["voice_item"]["text"])
        elif t == ITEM_FILE:
            name = (item.get("file_item") or {}).get("file_name") or ""
            parts.append(f"[文件] {name}".strip())
        elif t in _MEDIA_LABEL:
            parts.append(_MEDIA_LABEL[t])
    return "\n".join(p for p in parts if p)


class ILinkClient:
    def __init__(
        self,
        token: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        bot_agent: str = f"WeChatAgent/{__version__}",
        session: requests.Session | None = None,
    ):
        self.token = token
        self.base_url = base_url.rstrip("/")
        self.bot_agent = bot_agent
        self.http = session or requests.Session()
        self._typing_tickets: dict[str, str] = {}

    # ------------------------------------------------------------------ helpers
    def _common_headers(self) -> dict[str, str]:
        return {
            "iLink-App-Id": ILINK_APP_ID,
            "iLink-App-ClientVersion": str(_client_version(__version__)),
        }

    def _base_info(self) -> dict[str, str]:
        return {"channel_version": __version__, "bot_agent": self.bot_agent}

    def _url(self, endpoint: str, base_url: str | None = None) -> str:
        return f"{(base_url or self.base_url).rstrip('/')}/{endpoint}"

    def _post(self, endpoint: str, body: dict[str, Any], timeout: float = 15, base_url: str | None = None,
              auth: bool = True) -> dict[str, Any]:
        headers = {
            "Content-Type": "application/json",
            "AuthorizationType": "ilink_bot_token",
            "X-WECHAT-UIN": _random_uin(),
            **self._common_headers(),
        }
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        resp = self.http.post(self._url(endpoint, base_url), json=body, headers=headers, timeout=timeout)
        if resp.status_code >= 400:
            raise ILinkError(f"{endpoint} HTTP {resp.status_code}: {resp.text[:300]}")
        return _loads(resp.text)

    def _get(self, endpoint: str, timeout: float, base_url: str | None = None) -> dict[str, Any]:
        resp = self.http.get(self._url(endpoint, base_url), headers=self._common_headers(), timeout=timeout)
        if resp.status_code >= 400:
            raise ILinkError(f"{endpoint} HTTP {resp.status_code}: {resp.text[:300]}")
        return _loads(resp.text)

    @staticmethod
    def _check(resp: dict[str, Any], what: str) -> dict[str, Any]:
        ret, errcode = resp.get("ret"), resp.get("errcode")
        code = errcode if errcode not in (None, 0) else ret
        if code not in (None, 0):
            msg = f"{what} failed: ret={ret} errcode={errcode} errmsg={resp.get('errmsg', '')}"
            if code == STALE_TOKEN_ERRCODE:
                raise SessionExpired(msg, code)
            raise ILinkError(msg, code)
        return resp

    # ------------------------------------------------------------------ login
    def fetch_qrcode(self, bot_type: str = DEFAULT_BOT_TYPE) -> dict[str, Any]:
        """Returns {"qrcode": <id>, "qrcode_img_content": <url to encode as QR>}."""
        return self._post(f"ilink/bot/get_bot_qrcode?bot_type={bot_type}", {"local_token_list": []},
                          base_url=DEFAULT_BASE_URL, auth=False)

    def poll_qrcode_status(self, qrcode: str, base_url: str = DEFAULT_BASE_URL,
                           verify_code: str | None = None) -> dict[str, Any]:
        endpoint = f"ilink/bot/get_qrcode_status?qrcode={requests.utils.quote(qrcode, safe='')}"
        if verify_code:
            endpoint += f"&verify_code={requests.utils.quote(verify_code, safe='')}"
        try:
            return self._get(endpoint, timeout=40, base_url=base_url)
        except (requests.Timeout, requests.ConnectionError, ILinkError) as e:
            log.debug("qrcode status poll error, treating as wait: %s", e)
            return {"status": "wait"}

    # ------------------------------------------------------------------ messaging
    def get_updates(self, get_updates_buf: str = "", timeout_ms: int = 35_000) -> dict[str, Any]:
        try:
            resp = self._post("ilink/bot/getupdates",
                              {"get_updates_buf": get_updates_buf, "base_info": self._base_info()},
                              timeout=timeout_ms / 1000 + 5)
        except requests.Timeout:
            return {"ret": 0, "msgs": [], "get_updates_buf": get_updates_buf}
        return self._check(resp, "getupdates")

    def send_text(self, to_user_id: str, text: str, context_token: str | None = None) -> dict[str, Any]:
        msg: dict[str, Any] = {
            "from_user_id": "",
            "to_user_id": to_user_id,
            "client_id": f"wechat-agent-{uuid.uuid4().hex}",
            "message_type": MSG_TYPE_BOT,
            "message_state": MSG_STATE_FINISH,
            "item_list": [{"type": ITEM_TEXT, "text_item": {"text": text}}],
        }
        if context_token:
            msg["context_token"] = context_token
        resp = self._post("ilink/bot/sendmessage", {"msg": msg, "base_info": self._base_info()})
        return self._check(resp, "sendmessage")

    def set_typing(self, user_id: str, context_token: str | None, typing: bool = True) -> None:
        """Best-effort "正在输入..." indicator; never raises."""
        try:
            ticket = self._typing_tickets.get(user_id)
            if not ticket:
                body: dict[str, Any] = {"ilink_user_id": user_id, "base_info": self._base_info()}
                if context_token:
                    body["context_token"] = context_token
                ticket = self._post("ilink/bot/getconfig", body, timeout=10).get("typing_ticket")
                if not ticket:
                    return
                self._typing_tickets[user_id] = ticket
            self._post("ilink/bot/sendtyping", {
                "ilink_user_id": user_id,
                "typing_ticket": ticket,
                "status": TYPING if typing else TYPING_CANCEL,
                "base_info": self._base_info(),
            }, timeout=10)
        except Exception as e:  # noqa: BLE001
            log.debug("typing indicator failed: %s", e)

    def notify(self, start: bool) -> None:
        try:
            self._post(f"ilink/bot/msg/notify{'start' if start else 'stop'}",
                       {"base_info": self._base_info()}, timeout=10)
        except Exception as e:  # noqa: BLE001
            log.debug("notify %s failed: %s", "start" if start else "stop", e)

    @staticmethod
    def parse_inbound(resp: dict[str, Any]) -> list[InboundMessage]:
        out: list[InboundMessage] = []
        for m in resp.get("msgs") or []:
            if m.get("message_type") != MSG_TYPE_USER:
                continue  # skip echoes of our own bot messages
            text = extract_text(m)
            if not text or not m.get("from_user_id"):
                continue
            out.append(InboundMessage(
                from_user_id=m["from_user_id"],
                text=text,
                context_token=m.get("context_token"),
                message_id=str(m["message_id"]) if m.get("message_id") is not None else None,
                group_id=m.get("group_id"),
                raw=m,
            ))
        return out


def login_interactive(show_qr, poll_interval: float = 1.0, max_refresh: int = 3,
                      read_verify_code=None) -> dict[str, str]:
    """Run the QR login flow. ``show_qr(url)`` renders the QR for the user to scan in WeChat.

    Returns {"token", "base_url", "bot_id", "user_id"}.
    """
    client = ILinkClient()
    qr = client.fetch_qrcode()
    show_qr(qr["qrcode_img_content"])
    poll_base = DEFAULT_BASE_URL
    refreshes = 0
    verify_code: str | None = None
    scanned = False
    while True:
        st = client.poll_qrcode_status(qr["qrcode"], base_url=poll_base, verify_code=verify_code)
        status = st.get("status")
        if status == "scaned" and not scanned:
            scanned = True
            print("已扫码，请在手机上确认… / Scanned, confirm on your phone…")
        elif status == "scaned_but_redirect" and st.get("redirect_host"):
            poll_base = f"https://{st['redirect_host']}"
        elif status == "need_verifycode":
            reader = read_verify_code or (lambda: input("输入手机微信显示的数字 / Enter the number shown in WeChat: "))
            verify_code = reader().strip()
            continue
        elif status in ("expired", "verify_code_blocked"):
            refreshes += 1
            if refreshes > max_refresh:
                raise ILinkError("二维码多次失效，请稍后重试 / QR code expired too many times")
            print("二维码已过期，正在刷新… / QR expired, refreshing…")
            qr = client.fetch_qrcode()
            show_qr(qr["qrcode_img_content"])
            poll_base, verify_code, scanned = DEFAULT_BASE_URL, None, False
        elif status == "binded_redirect":
            raise ILinkError("该微信已绑定过此 Bot，若需重新登录请先在微信中解绑 / already bound")
        elif status == "confirmed":
            if not st.get("bot_token") or not st.get("ilink_bot_id"):
                raise ILinkError(f"login confirmed but token missing: {st}")
            return {
                "token": st["bot_token"],
                "base_url": st.get("baseurl") or DEFAULT_BASE_URL,
                "bot_id": st["ilink_bot_id"],
                "user_id": st.get("ilink_user_id") or "",
            }
        time.sleep(poll_interval)
