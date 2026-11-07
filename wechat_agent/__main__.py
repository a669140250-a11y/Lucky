"""CLI: python -m wechat_agent {login|run|logout}"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from .agents import build_agent
from .bot import Bridge, load_account, save_account, state_dir
from .ilink import ILinkClient, login_interactive


def _load_dotenv(path: Path = Path(".env")) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def _show_qr(url: str) -> None:
    print("\n请用微信扫描下方二维码 / Scan with WeChat:\n")
    try:
        import qrcode

        qr = qrcode.QRCode(border=1)
        qr.add_data(url)
        qr.print_ascii(invert=True)
    except ImportError:
        pass
    print(f"\n若二维码显示异常，可在浏览器打开此链接再扫码 / Or open:\n{url}\n")


def cmd_login(_: argparse.Namespace) -> None:
    acc = login_interactive(_show_qr)
    path = save_account(acc)
    print(f"✅ 登录成功 / Logged in. bot_id={acc['bot_id']}  saved to {path}")
    (state_dir() / "get_updates_buf").unlink(missing_ok=True)


def cmd_run(args: argparse.Namespace) -> None:
    acc = load_account()
    if not acc:
        print("尚未登录，先扫码… / Not logged in, starting QR login…")
        cmd_login(args)
        acc = load_account()
    agent = build_agent(args.provider)
    allow = {u.strip() for u in os.environ.get("ALLOW_USERS", "").split(",") if u.strip()} or None
    client = ILinkClient(token=acc["token"], base_url=acc.get("base_url") or "https://ilinkai.weixin.qq.com")
    Bridge(client, agent, history_turns=int(os.environ.get("HISTORY_TURNS", "20")),
           allow_users=allow).run_forever()


def cmd_logout(_: argparse.Namespace) -> None:
    for name in ("account.json", "get_updates_buf"):
        (state_dir() / name).unlink(missing_ok=True)
    print("已删除本地登录信息 / Local credentials removed.")


def main(argv: list[str] | None = None) -> None:
    _load_dotenv()
    p = argparse.ArgumentParser(prog="wechat_agent", description="把微信接入你的 AI Agent (official iLink)")
    p.add_argument("-v", "--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("login", help="扫码登录 / QR login").set_defaults(fn=cmd_login)
    r = sub.add_parser("run", help="启动机器人 / start the bridge")
    r.add_argument("--provider", help="claude | grok | muse | openai (default: $AGENT_PROVIDER)")
    r.set_defaults(fn=cmd_run)
    sub.add_parser("logout", help="删除本地凭据 / remove local credentials").set_defaults(fn=cmd_logout)
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    try:
        args.fn(args)
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
