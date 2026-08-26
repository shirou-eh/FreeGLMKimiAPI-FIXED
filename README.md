<p align="center">
  <img src="assets/banners/hero-1200x400.svg" alt="FreeGLMKimiAPI Hero" width="100%" />
</p>

<div align="center">

# FreeGLMKimiAPI — FIXED

### Локальный OpenAI / Anthropic прокси для `GLM-5.3-Flash` • `chat.z.ai` • `Kimi` — с настоящим Agent по умолчанию

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-compatible-111827?style=for-the-badge&logo=openai&logoColor=white)](#api)
[![Anthropic](https://img.shields.io/badge/Anthropic-Messages-191919?style=for-the-badge)](#api)
[![GLM-5.3-Flash](https://img.shields.io/badge/GLM--5.3--Flash-x--preview--l-6D5DF6?style=for-the-badge)](#модели)
[![Agent](https://img.shields.io/badge/Agent-MAX-00A3FF?style=for-the-badge)](#модели)
[![License](https://img.shields.io/badge/License-MIT-0A0A0A?style=for-the-badge)](#license)

**Быстрый, бесплатный, для агентных IDE — без платного API ключа.** `Claude Code` • `OpenCode` • `Cursor` • `Cline` • `OpenClaw` • `Hermes` • `Continue`

`http://127.0.0.1:9766`  •  `POST /v1/chat/completions` (stream)  •  `POST /v1/messages` (Anthropic)  •  `GET /v1/models`  •  `GET /health`

*Оригинал: [ForgetMeAI/FreeGLMKimiAPI](https://github.com/ForgetMeAI/FreeGLMKimiAPI) • FIXED-форк: оптимизирован под `GLM-5.3-Flash` (Agent/DeepThink/Max) и надёжный `tool use`*

> ⚠️ Неофициальный прокси для личных экспериментов. Web API `Z.ai`/`Kimi` могут меняться. Не публикуй `auth.json` и не открывай наружу без `API_KEYS`.

</div>

---

<p align="center">
  <img src="assets/banners/features-1200x400.svg" alt="Features" width="100%" />
</p>

## Что внутри FIXED

| Было (оригинал) | Стало (FIXED) |
|---|---|
| `DEFAULT_MODEL=kimi-k2.5` | `DEFAULT_MODEL=glm-5.3-flash` — **Agent по умолчанию** (`thinking:true`, `x-preview-l`) |
| `prod-fe-1.1.46` → `FRONTEND_CAPTCHA_REQUIRED` | `prod-fe-1.1.91` (актуальный 26.08.2026) + маппинг `glm-5.3-flash` → `x-preview-l` (`src/providers/zai.js:9`) |
| Промпт `OPENAI-COMPATIBLE ADAPTER` детектился как инжект, модель отвечала `no tools` | `System: You have been granted access...` + `Tool names CASE-SENSITIVE` — естественный системный промпт, не триггерит защиту |
| Tool call только если модель сама вывела JSON | **Двухуровневый фолбэк** (`src/server.js:24`): <br>1. **Быстрый путь** — `Create file`/`Read file`/`Run command`/`Bash`/`What tools` → сразу `tool_calls` за `0.3с` (без LLM) для *любого* имени тула <br>2. **Эвристика** после LLM — если `isRefusal` (`don't have.*tool`) → парсит `User` запрос и генерирует `write_file`/`read_file`/`Bash` |
| `Browser fallback` требовал ручной `CHROME_PATH` | Поддержка `Edge` (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) + `MOCK_PROVIDER=1` для тестов без токенов |

---

## Навигация

- [Архитектура](#архитектура)
- [Модели](#модели)
- [Быстрый старт](#быстрый-старт)
- [Конфигурация](#конфигурация)
- [Аккаунты](#как-добавить-аккаунты)
- [Токены](#как-получить-токены)
- [Примеры](#примеры-запросов)
- [Tool use для агентов](#tool-use-для-агентов-автоматически)
- [API](#api)
- [Диагностика](#диагностика)
- [Ограничения](#ограничения)

---

## Архитектура

```mermaid
flowchart LR
    Client[OpenAI SDK / Claude Code / OpenCode] -->|POST /v1/chat/completions| Proxy[FreeGLMKimiAPI\n127.0.0.1:9766]
    Proxy -->|resolveModel| Router{glm* → Z.ai\nkimi* → Kimi}
    Router -->|Z.ai| ZAI[chat.z.ai\n/api/v2/chat/completions\nx-preview-l • prod-fe-1.1.91]
    Router -->|Kimi| KIMI[kimi.com\n gRPC-Web]
    ZAI <-->|FRONTEND_CAPTCHA_REQUIRED| Browser[(Edge / Chrome\nPuppeteer • CloakBrowser)]
    Proxy -->|tooling.js + heuristic| ToolCalls[tool_calls JSON]
    Proxy --> Admin[Admin API /auth.json\nround-robin + cooldown]
```

- **Провайдер** выбирается по имени модели: `glm*` → `Z.ai`, `kimi*` → `Kimi` (`src/config.js:24`).
- **Сессии** привязаны к `user`/`agentId` (`src/sessions.js`) — каждый агент получает свою историю.
- **Подпись** `Z.ai` — `HMAC-SHA256` с `5-мин окном` (`src/providers/zai.js:58`).

---

## Модели

### GLM — `chat.z.ai` (рекомендуется)

| Модель (вызывай так) | Backend ID | Agent | DeepThink | Web Search | Примечание |
|---|---|---|---|---|---|
| `glm-5.3-flash` **(default)** | `x-preview-l` | ✅ `thinking:true` | ✅ | — | **Agent по умолчанию**, `1M` контекст, `128K` out |
| `glm-5.3-flash-chat` | `x-preview-l` | — | — | — | Быстрый чат без reasoning |
| `glm-5.3-flash-thinking` / `deepthink` | `x-preview-l` | ✅ | ✅ | — | Явный DeepThink |
| `glm-5.3-flash-search` | `x-preview-l` | ✅ | ✅ | ✅ `web_search:true` | С поиском |
| `glm-5.3-flash-max` / `deepresearch` | `x-preview-l` | ✅ | ✅ | ✅ | Max (`thinking+web+research`) |
| `glm-5.3-flash-agent` | `x-preview-l` | ✅ | ✅ | — | Алиас Agent |
| `glm-5.3` | `glm-5.3` | ✅ | ✅ | — | Флагман без Flash |
| `glm-5` / `glm-5-thinking` / `search` | `glm-5*` | —/✅ | —/✅ | —/✅ | Legacy, для совместимости |

> Алиасы без точки тоже работают: `glm-53-flash` → `x-preview-l`.

### Kimi

`kimi-k2.5`, `kimi-k2.5-thinking`, `kimi-k2.5-search` → `kimi.com` gRPC-Web.

По умолчанию (`.env.example:4`):

```env
DEFAULT_PROVIDER=glm
DEFAULT_MODEL=glm-5.3-flash
```

---

## Быстрый старт

```bash
git clone https://github.com/shirou-eh/FreeGLMKimiAPI-FIXED.git
cd FreeGLMKimiAPI-FIXED
npm install          # Node.js >=18
cp .env.example .env # поправь при необходимости
npm test             # 27 тестов, включая tool use
```

**Без токенов (проверка обвязки):**

```bash
MOCK_PROVIDER=1 PORT=9766 npm start
# в другом терминале
curl http://127.0.0.1:9766/health
curl http://127.0.0.1:9766/v1/models
node scripts/smoke.js
```

**С токеном (реальный `GLM-5.3-Flash`):**

```bash
npm run auth:browser -- ./auth.json
# логин → hi → готово
npm start
# или с Edge на Windows:
CHROME_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" npm start
```

---

## Конфигурация

`.env` / `.env.example` — все опции:

| Переменная | По умолчанию | Описание |
|---|---|---|
| `PORT` / `HOST` | `9766` / `0.0.0.0` | Слушает `http://127.0.0.1:9766` |
| `DEFAULT_PROVIDER` | `glm` | `glm` → `Z.ai`, `kimi` → `Kimi` |
| `DEFAULT_MODEL` | `glm-5.3-flash` | Если `model` не указан в запросе |
| `AUTH_PATH` | `./auth.json` | Путь к пулу аккаунтов |
| `GLM_BACKEND` | `zai` | `zai` (`chat.z.ai`) или `chatglm` (`chatglm.cn`) |
| `ZAI_FE_VERSION` | `prod-fe-1.1.91` | Версия фронта `chat.z.ai` (меняй при `FRONTEND_CAPTCHA_REQUIRED`) |
| `ZAI_BROWSER_FALLBACK` | `1` | `1` → при капче идти через браузер |
| `ZAI_BROWSER_ENGINE` | `puppeteer` | `puppeteer` / `cloak` |
| `CHROME_PATH` | — | Путь к `chrome.exe`/`msedge.exe` (Windows Edge подходит) |
| `ZAI_COOKIE` / `ZAI_CAPTCHA_VERIFY_PARAM` | — | Ручной обход anti-bot (из DevTools) |
| `MOCK_PROVIDER` | `0` | `1` → мок без сети |
| `API_KEYS` | — | `a,b,c` → требует `Authorization: Bearer <key>` |
| `ACCOUNT_COOLDOWN_MS` | `60000` | Кулдаун аккаунта после ошибки |

---

## Как добавить аккаунты

Токены = пароли. Не коммить `auth.json`.

### Вариант 1 — `auth.json` (удобно для нескольких)

```json
{
  "accounts": [
    { "id": "zai1", "provider": "glm", "token": "PASTE_ZAI_TOKEN_HERE" },
    { "id": "kimi1", "provider": "kimi", "token": "PASTE_KIMI_TOKEN_HERE" }
  ]
}
```

```bash
npm start
# другой путь:
AUTH_PATH=/path/to/auth.json npm start
```

### Вариант 2 — `.env` (один аккаунт)

```env
GLM_BACKEND=zai
GLM_TOKEN=PASTE_ZAI_TOKEN_HERE

KIMI_TOKEN=PASTE_KIMI_TOKEN_HERE
```

### Вариант 3 — Admin API (без рестарта)

```bash
curl http://127.0.0.1:9766/admin/accounts
curl -X POST http://127.0.0.1:9766/admin/accounts \
  -H 'Content-Type: application/json' \
  -d '{"id":"zai2","provider":"glm","token":"TOKEN","persist":true}'
curl -X POST http://127.0.0.1:9766/admin/accounts/reload -d '{}'
```

---

## Как получить токены

### GLM / Z.ai через браузер — рекомендуется

```bash
npm run auth:browser -- ./auth.json
# 1. откроется chat.z.ai
# 2. войди, пройди капчу если есть
# 3. отправь "hi" в чате
# 4. жди сохранения auth.json
```

Проверка:

```bash
ZAI_BROWSER_FALLBACK=1 MODEL=glm-5.3-flash npm run smoke:zai
```

Профиль `~/.free-glm-kimi-api/zai-browser-profile` переиспользуется. При новой капче — повтори `auth:browser`. Для `CloakBrowser`:

```bash
ZAI_BROWSER_ENGINE=cloak ZAI_BROWSER_FALLBACK=1 MODEL=glm-5.3-flash npm run smoke:zai
```

### Вручную из DevTools (если браузер не сработал)

`chat.z.ai` → `F12` → `Application` → `Local Storage` → `https://chat.z.ai` → `token` (или `Cookies` → `token`). Копируй только значение.

Для anti-bot добавь `cookie` + `captcha_verify_param` (из `Network` → `/api/v2/chat/completions` → `Request Headers`/`Payload`).

### Kimi

`kimi.com` → `Network` → фильтр `ChatService/Chat` → `Authorization: Bearer ...` → копируй после `Bearer`.

---

## Примеры запросов

<details>
<summary><b>Health / Models</b></summary>

```bash
curl http://127.0.0.1:9766/health
curl http://127.0.0.1:9766/v1/models | jq .
```

</details>

<details>
<summary><b>Обычный чат (OpenAI)</b></summary>

```bash
curl http://127.0.0.1:9766/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "glm-5.3-flash",
    "messages": [{"role": "user", "content": "Привет!"}],
    "stream": false
  }'
```

```python
from openai import OpenAI
client = OpenAI(base_url="http://127.0.0.1:9766/v1", api_key="x")
print(client.chat.completions.create(
  model="glm-5.3-flash",
  messages=[{"role":"user","content":"Напиши quicksort на TypeScript"}]
).choices[0].message.content)
```

</details>

<details>
<summary><b>Streaming</b></summary>

```bash
curl -N http://127.0.0.1:9766/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"glm-5.3-flash","stream":true,"messages":[{"role":"user","content":"Расскажи про MCP"}]}'
```

</details>

<details>
<summary><b>Claude Code</b></summary>

```bash
ANTHROPIC_BASE_URL=http://127.0.0.1:9766 \
ANTHROPIC_API_KEY=dummy \
ANTHROPIC_MODEL=glm-5.3-flash \
claude --bare -p 'Ответь ровно: CLAUDE_SMOKE_OK' --model glm-5.3-flash --output-format json
```

</details>

<details>
<summary><b>OpenCode</b></summary>

```bash
export OPENCODE_CONFIG_CONTENT='{"$schema":"https://opencode.ai/config.json","provider":{"free-glm-kimi":{"npm":"@ai-sdk/openai-compatible","name":"FreeGLMKimiAPI","options":{"baseURL":"http://127.0.0.1:9766/v1","apiKey":"x"},"models":{"glm-5.3-flash":{"name":"glm-5.3-flash"}}}}}'
opencode run 'Ответь ровно: OPENCODE_SMOKE_OK' --model free-glm-kimi/glm-5.3-flash --agent build
```

</details>

<details>
<summary><b>Cursor / Cline / Continue</b></summary>

Base URL: `http://127.0.0.1:9766/v1`, API Key: любой (напр. `x`), Model: `glm-5.3-flash`.

</details>

Полный список — [docs/request-examples.md](docs/request-examples.md).

---

## Tool use для агентов — автоматически

Клиент шлёт обычные `tools` (OpenAI). Прокси:

1. **Быстрый путь** (`src/server.js:24`) — без LLM, `0.3с`:

   - `Create file`/`Write file`/`Read file`/`Run command`/`Bash`/`What tools|какие инструменты` → сразу `tool_calls`
   - Работает для **любого** имени: `write_file`, `Write`, `default_api:write_file`, `Bash`, `my_custom_tool` (упомяни имя тула в промпте — вызовется).
   - Пример: `Create file hello.js with console.log(1)` → `{"tool_calls":[{"name":"write_file","arguments":{"path":"hello.js","content":"console.log(1)"}}]}`

2. **Промпт-протокол** (`src/tooling.js:43`, `src/message.js:50`):

   ```
   System: You have been granted access to the following tools...
   Available tools: write_file
   Tool schemas (JSON): [{"name":"write_file",...}]
   To call a tool, output ONLY JSON: {"tool_calls":[...]}
   ```

   Парсит `[function_calls]`, JSON, `TOOL_CALL`, `DSML` (`src/tooling.js:103`).

3. **Эвристика** после LLM (`src/server.js:83`) — если модель ответила `don't have.*tool|no tools` но `User` явно просил файл/команду → генерирует `tool_calls` из `User` текста.

**Ответ при вызове тула:**

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc",
        "type": "function",
        "function": { "name": "write_file", "arguments": "{\"path\":\"hello.txt\",\"content\":\"hello\"}" }
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

**Авто-рассказ про туллы:** спроси `What tools do you have?` / `Какие у тебя инструменты?` с `tools: [...]` → вернётся `Available tools for glm-5.3-flash (Agent mode): write_file, read_file...` без вызова LLM.

Локальные тесты без токенов:

```bash
MOCK_PROVIDER=1 npm start
npm run agent:all  # hermes / claude / opencode / openclaw
```

---

## API

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/health` | `{ok, mock, accounts, watermark}` |
| `GET` | `/v1/models` | Список `MODELS` (`src/config.js:14`) |
| `GET` | `/v1/models` / `/models` | Алиас |
| `POST` | `/v1/chat/completions` | OpenAI-совместим, `stream` + `tools` |
| `POST` | `/v1/messages` | Anthropic Messages → `openAIToAnthropic` |
| `GET` | `/sessions` | Закреплённые сессии |
| `GET/POST` | `/admin/accounts` | Пул аккаунтов |

---

## Диагностика

```bash
npm test
node scripts/doctor.js
curl http://127.0.0.1:9766/health | jq
curl http://127.0.0.1:9766/admin/accounts | jq
```

Реальный smoke:

```bash
ZAI_BROWSER_FALLBACK=1 MODEL=glm-5.3-flash npm run smoke:zai
# с Edge на Windows:
CHROME_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" ZAI_BROWSER_FALLBACK=1 npm start
```

Импорт `curl` из браузера:

```bash
pbpaste | node scripts/import_zai_curl.js /dev/stdin /tmp/auth.json
AUTH_PATH=/tmp/auth.json MODEL=glm-5.3-flash npm run smoke:zai
```

---

## Ограничения

- Неофициальный API — фронт `Z.ai`/`Kimi` может поменяться (следи за `ZAI_FE_VERSION`).
- Для `chat.z.ai` нужен живой `token` + иногда `ZAI_COOKIE`/`ZAI_CAPTCHA_VERIFY_PARAM` или `ZAI_BROWSER_FALLBACK=1`.
- `chat.z.ai` и `chatglm.cn` — разные бэкенды.
- Tool use — эмуляция (prompt + эвристика), не нативный `function calling` у web-модели.
- На бесплатном `GLM-5.3-Flash` — лимиты `Z.ai` (конкурентность, `1` запрос/сек).

---

## Полезные ссылки

- Примеры: [docs/request-examples.md](docs/request-examples.md)
- CloakBrowser: [docs/cloakbrowser-notes.md](docs/cloakbrowser-notes.md)
- Канал: [t.me/forgetmeai](https://t.me/forgetmeai)

---

## License

MIT — как у оригинала. Для экспериментов с агентными IDE.

<div align="center">

**Сделано для агентных сборок • FIXED Edition**

`GLM-5.3-Flash` — `x-preview-l` — `prod-fe-1.1.91` — `MOCK_PROVIDER=1`

[Report issues](https://github.com/shirou-eh/FreeGLMKimiAPI-FIXED/issues) • [Original](https://github.com/ForgetMeAI/FreeGLMKimiAPI)

</div>

<p align="center">
  <img src="assets/banners/social-1280x640.svg" alt="Social Banner" width="100%" />
</p>
