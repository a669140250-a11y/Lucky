import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from wechat_agent import bot
from wechat_agent.ilink import ILinkClient, SessionExpired, _loads, extract_text


class FakeILink(BaseHTTPRequestHandler):
    calls: list = []
    updates: list = []

    def log_message(self, *a):
        pass

    def _reply(self, obj):
        data = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])) or b"{}")
        FakeILink.calls.append((self.path, dict(self.headers), body))
        if self.path.startswith("/ilink/bot/getupdates"):
            self._reply(FakeILink.updates.pop(0) if FakeILink.updates else {"ret": -14, "errcode": -14})
        elif self.path.startswith("/ilink/bot/getconfig"):
            self._reply({"ret": 0, "typing_ticket": "tkt"})
        else:
            self._reply({"ret": 0, "message_id": "1"})


@pytest.fixture
def server(tmp_path, monkeypatch):
    monkeypatch.setenv("STATE_DIR", str(tmp_path))
    FakeILink.calls, FakeILink.updates = [], []
    srv = HTTPServer(("127.0.0.1", 0), FakeILink)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_port}"
    srv.shutdown()


class EchoAgent:
    name = "echo"

    def __init__(self):
        self.seen = []

    def reply(self, history):
        self.seen.append(list(history))
        return "echo: " + history[-1]["content"]


def test_extract_text_and_bigint():
    msg = {"item_list": [
        {"type": 1, "text_item": {"text": "hi"}},
        {"type": 3, "voice_item": {"text": "语音转文字"}},
        {"type": 2, "image_item": {}},
    ]}
    assert extract_text(msg) == "hi\n语音转文字\n[图片]"
    assert _loads('{"message_id": 12345678901234567890}')["message_id"] == "12345678901234567890"


def test_split_text():
    parts = bot.split_text("a" * 4000, 1800)
    assert [len(p) for p in parts] == [1800, 1800, 400]


def test_end_to_end(server):
    FakeILink.updates = [{
        "ret": 0,
        "get_updates_buf": "BUF1",
        "msgs": [
            {"message_id": 99999999999999999, "message_type": 1, "from_user_id": "u@im.wechat",
             "context_token": "ctx", "item_list": [{"type": 1, "text_item": {"text": "你好"}}]},
            {"message_type": 2, "from_user_id": "bot", "item_list": [{"type": 1, "text_item": {"text": "x"}}]},
        ],
    }]
    agent = EchoAgent()
    b = bot.Bridge(ILinkClient(token="TOKEN", base_url=server), agent)
    with pytest.raises(SessionExpired):
        b.run_forever()  # second getupdates returns -14 and stops the loop
    b.pool.shutdown(wait=True)

    assert agent.seen == [[{"role": "user", "content": "你好"}]]
    paths = [c[0] for c in FakeILink.calls]
    assert "/ilink/bot/sendmessage" in paths
    _, headers, body = next(c for c in FakeILink.calls if c[0] == "/ilink/bot/sendmessage")
    assert headers["Authorization"] == "Bearer TOKEN"
    assert headers["AuthorizationType"] == "ilink_bot_token"
    assert headers["iLink-App-Id"] == "bot"
    m = body["msg"]
    assert m["to_user_id"] == "u@im.wechat" and m["context_token"] == "ctx"
    assert m["message_type"] == 2 and m["message_state"] == 2
    assert m["item_list"] == [{"type": 1, "text_item": {"text": "echo: 你好"}}]
    assert (bot.state_dir() / "get_updates_buf").read_text() == "BUF1"
    gu = next(c for c in FakeILink.calls if c[0] == "/ilink/bot/getupdates")
    assert gu[2]["get_updates_buf"] == "" and "base_info" in gu[2]
