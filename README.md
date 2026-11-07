# 把微信接入你的 AI Agent（Claude / Grok / Muse）

**Connect WeChat to your personal AI agent via the official iLink Bot API.**

This project uses Tencent's official **iLink** bot protocol (`ilinkai.weixin.qq.com`), the same one used by the official `@tencent-weixin/openclaw-weixin` WeChat plugin. You don't need a hooked client or a web-protocol account: you scan a QR code once, and your AI replies to the messages people send your bot in WeChat.

```
微信用户 ──► iLink getupdates (长轮询) ──► Bridge ──► Claude / Grok / Muse / OpenAI-compatible
        ◄── iLink sendmessage ◄────────────┘
```

## 功能 Features

- 官方扫码登录（支持换机房重定向、验证码配对、二维码过期自动刷新）
- 长轮询收消息，断点续传（`get_updates_buf` 本地持久化，重启不丢消息）
- 多轮对话上下文（按用户隔离，可配置轮数），并发处理多个用户
- 文本、语音（使用微信服务端转写文字）、引用消息；图片/文件/视频以占位符告知模型
- “对方正在输入…” 状态、长回复自动分段
- 内置命令：`/reset` 清空上下文 · `/whoami` · `/help`
- 白名单 `ALLOW_USERS`
- 后端可切换：**Claude**（Anthropic）、**Grok**（xAI）、**Muse** / 任意 OpenAI 兼容接口

## 快速开始 Quick start

```bash
pip install -r requirements.txt
cp .env.example .env        # 填入你的 API Key / fill in your API key

python -m wechat_agent login   # 终端显示二维码，用微信扫码并确认
python -m wechat_agent run     # 启动；或 run --provider grok
```

When `login` succeeds, it saves `bot_token` to `~/.wechat-agent/account.json` (permissions 600). Send your bot a message in WeChat and the AI replies.

If the server returns `errcode -14`, the login has expired. Run `python -m wechat_agent login` again.

## 配置 Configuration（`.env` 或环境变量）

| 变量 | 说明 |
|---|---|
| `AGENT_PROVIDER` | `claude` \| `grok` \| `muse` \| `openai` |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Claude，默认 `claude-sonnet-5-5` |
| `XAI_API_KEY`, `GROK_MODEL`, `XAI_BASE_URL` | Grok，默认 `https://api.x.ai/v1`、`grok-4` |
| `MUSE_API_KEY`, `MUSE_BASE_URL`, `MUSE_MODEL` | Muse 或任意 OpenAI 兼容服务（三项必填） |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | 通用 OpenAI 兼容（DeepSeek、Qwen、Ollama…） |
| `SYSTEM_PROMPT` | 系统提示词 |
| `HISTORY_TURNS` | 每个用户保留的对话轮数，默认 20 |
| `ALLOW_USERS` | 逗号分隔的允许用户 id（用 `/whoami` 获取），留空表示所有人 |
| `STATE_DIR` | 状态目录，默认 `~/.wechat-agent` |

## iLink 协议要点 Protocol notes

| 接口 | 用途 |
|---|---|
| `POST ilink/bot/get_bot_qrcode?bot_type=3` | 获取登录二维码 |
| `GET ilink/bot/get_qrcode_status?qrcode=…` | 长轮询扫码状态，`confirmed` 时返回 `bot_token` / `baseurl` |
| `POST ilink/bot/getupdates` | 长轮询消息，携带并保存 `get_updates_buf` |
| `POST ilink/bot/sendmessage` | 发送消息，必须带回入站消息的 `context_token` |
| `POST ilink/bot/getconfig` + `sendtyping` | 输入中状态 |

Request headers: `AuthorizationType: ilink_bot_token`, `Authorization: Bearer <bot_token>`, `X-WECHAT-UIN: base64(random uint32)`, `iLink-App-Id`, and `iLink-App-ClientVersion`.

## 扩展 Extending

To add a new backend, implement `reply(history) -> str` (see `wechat_agent/agents.py`). This is also how you connect your own agent framework, such as one with tool calling or RAG.

## 测试 Tests

```bash
pip install pytest && python -m pytest -q
```

The tests use a local fake iLink server to check the request headers and message format end to end.
