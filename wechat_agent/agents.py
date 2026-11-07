"""AI agent backends: Claude (Anthropic Messages API) and any OpenAI-compatible
chat endpoint (Grok / xAI, Muse, OpenAI, local models, ...)."""

from __future__ import annotations

import os
from typing import Protocol

import requests

Message = dict[str, str]  # {"role": "user"|"assistant", "content": str}


class Agent(Protocol):
    name: str

    def reply(self, history: list[Message]) -> str: ...


class ClaudeAgent:
    def __init__(self, api_key: str, model: str, system: str, max_tokens: int = 2048,
                 base_url: str = "https://api.anthropic.com"):
        self.name = f"claude:{model}"
        self.api_key, self.model, self.system = api_key, model, system
        self.max_tokens, self.base_url = max_tokens, base_url.rstrip("/")

    def reply(self, history: list[Message]) -> str:
        r = requests.post(
            f"{self.base_url}/v1/messages",
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={"model": self.model, "max_tokens": self.max_tokens,
                  "system": self.system, "messages": history},
            timeout=120,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Claude API {r.status_code}: {r.text[:300]}")
        data = r.json()
        return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text").strip()


class OpenAICompatAgent:
    def __init__(self, name: str, api_key: str, base_url: str, model: str, system: str,
                 max_tokens: int = 2048):
        self.name = f"{name}:{model}"
        self.api_key, self.model, self.system = api_key, model, system
        self.base_url, self.max_tokens = base_url.rstrip("/"), max_tokens

    def reply(self, history: list[Message]) -> str:
        messages = ([{"role": "system", "content": self.system}] if self.system else []) + history
        r = requests.post(
            f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            json={"model": self.model, "messages": messages, "max_tokens": self.max_tokens},
            timeout=120,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"{self.name} API {r.status_code}: {r.text[:300]}")
        return (r.json()["choices"][0]["message"].get("content") or "").strip()


DEFAULT_SYSTEM = (
    "你是用户在微信里的私人 AI 助手。微信不渲染 Markdown，请用纯文本、简洁地回答，"
    "必要时用换行和序号组织内容。Reply in the user's language."
)


def _need(var: str) -> str:
    v = os.environ.get(var, "").strip()
    if not v:
        raise SystemExit(f"缺少环境变量 / missing env var: {var}")
    return v


def build_agent(provider: str | None = None) -> Agent:
    provider = (provider or os.environ.get("AGENT_PROVIDER", "claude")).lower()
    system = os.environ.get("SYSTEM_PROMPT", DEFAULT_SYSTEM)
    if provider in ("claude", "anthropic"):
        return ClaudeAgent(_need("ANTHROPIC_API_KEY"),
                           os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5"), system,
                           base_url=os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com"))
    if provider in ("grok", "xai"):
        return OpenAICompatAgent("grok", _need("XAI_API_KEY"),
                                 os.environ.get("XAI_BASE_URL", "https://api.x.ai/v1"),
                                 os.environ.get("GROK_MODEL", "grok-4"), system)
    if provider == "muse":
        return OpenAICompatAgent("muse", _need("MUSE_API_KEY"), _need("MUSE_BASE_URL"),
                                 _need("MUSE_MODEL"), system)
    if provider in ("openai", "compat", "custom"):
        return OpenAICompatAgent("openai", _need("OPENAI_API_KEY"),
                                 os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
                                 os.environ.get("OPENAI_MODEL", "gpt-4o-mini"), system)
    raise SystemExit(f"未知 AGENT_PROVIDER / unknown provider: {provider} (claude|grok|muse|openai)")
