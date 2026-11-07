"""Bridge loop: WeChat (iLink long-poll) <-> AI agent."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .agents import Agent, Message
from .ilink import ILinkClient, ILinkError, InboundMessage, SessionExpired

log = logging.getLogger(__name__)

MAX_CHUNK = 1800  # keep each WeChat message comfortably short


def state_dir() -> Path:
    d = Path(os.path.expanduser(os.environ.get("STATE_DIR", "~/.wechat-agent")))
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_account() -> dict | None:
    p = state_dir() / "account.json"
    return json.loads(p.read_text()) if p.exists() else None


def save_account(acc: dict) -> Path:
    p = state_dir() / "account.json"
    p.write_text(json.dumps(acc, ensure_ascii=False, indent=2))
    try:
        p.chmod(0o600)
    except OSError:
        pass
    return p


def split_text(text: str, limit: int = MAX_CHUNK) -> list[str]:
    chunks: list[str] = []
    while len(text) > limit:
        cut = text.rfind("\n", 0, limit)
        if cut < limit // 2:
            cut = limit
        chunks.append(text[:cut].rstrip())
        text = text[cut:].lstrip("\n")
    if text.strip():
        chunks.append(text)
    return chunks or ["(空回复 / empty reply)"]


class Bridge:
    def __init__(self, client: ILinkClient, agent: Agent, history_turns: int = 20,
                 allow_users: set[str] | None = None, workers: int = 4):
        self.client = client
        self.agent = agent
        self.history: dict[str, deque[Message]] = defaultdict(lambda: deque(maxlen=history_turns * 2))
        self.locks: dict[str, threading.Lock] = defaultdict(threading.Lock)
        self.allow_users = allow_users
        self.pool = ThreadPoolExecutor(max_workers=workers)
        self.seen: deque[str] = deque(maxlen=1000)
        self.buf_path = state_dir() / "get_updates_buf"

    # ---------------------------------------------------------------- commands
    def _command(self, msg: InboundMessage) -> str | None:
        cmd = msg.text.strip().lower()
        if cmd in ("/reset", "/clear", "/新对话", "/清空"):
            self.history.pop(msg.from_user_id, None)
            return "已清空对话上下文。/ Conversation reset."
        if cmd in ("/help", "/帮助"):
            return (f"当前模型 / model: {self.agent.name}\n"
                    "/reset 清空上下文\n/whoami 查看你的 user id\n/help 帮助")
        if cmd == "/whoami":
            return msg.from_user_id
        return None

    def handle(self, msg: InboundMessage) -> None:
        uid = msg.from_user_id
        with self.locks[uid]:  # serialize per user so history stays ordered
            try:
                reply = self._command(msg)
                if reply is None:
                    hist = self.history[uid]
                    hist.append({"role": "user", "content": msg.text})
                    self.client.set_typing(uid, msg.context_token, True)
                    try:
                        reply = self.agent.reply(list(hist)) or "(模型没有返回内容)"
                    except Exception as e:  # noqa: BLE001
                        hist.pop()
                        log.exception("agent error")
                        reply = f"AI 调用失败，请稍后再试。\n{type(e).__name__}: {str(e)[:200]}"
                    else:
                        hist.append({"role": "assistant", "content": reply})
                    finally:
                        self.client.set_typing(uid, msg.context_token, False)
                for chunk in split_text(reply):
                    self.client.send_text(uid, chunk, msg.context_token)
                log.info("replied to %s (%d chars)", uid, len(reply))
            except Exception:  # noqa: BLE001
                log.exception("failed handling message from %s", uid)

    # ---------------------------------------------------------------- loop
    def run_forever(self) -> None:
        buf = self.buf_path.read_text() if self.buf_path.exists() else ""
        timeout_ms = 35_000
        failures = 0
        self.client.notify(True)
        log.info("listening for WeChat messages with %s …", self.agent.name)
        try:
            while True:
                try:
                    resp = self.client.get_updates(buf, timeout_ms)
                except SessionExpired:
                    log.error("登录已过期 (errcode -14)，请重新运行 `python -m wechat_agent login`")
                    raise
                except (ILinkError, OSError) as e:
                    failures += 1
                    delay = 30 if failures >= 3 else 2
                    log.warning("getupdates error (%d): %s; retry in %ds", failures, e, delay)
                    time.sleep(delay)
                    continue
                failures = 0
                if resp.get("longpolling_timeout_ms"):
                    timeout_ms = int(resp["longpolling_timeout_ms"])
                new_buf = resp.get("get_updates_buf")
                if new_buf and new_buf != buf:
                    buf = new_buf
                    self.buf_path.write_text(buf)
                for msg in ILinkClient.parse_inbound(resp):
                    if msg.message_id and msg.message_id in self.seen:
                        continue
                    if msg.message_id:
                        self.seen.append(msg.message_id)
                    if self.allow_users and msg.from_user_id not in self.allow_users:
                        log.info("ignored message from non-allowed user %s", msg.from_user_id)
                        continue
                    log.info("<- %s: %s", msg.from_user_id, msg.text[:80])
                    self.pool.submit(self.handle, msg)
        finally:
            self.client.notify(False)
            self.pool.shutdown(wait=False)
