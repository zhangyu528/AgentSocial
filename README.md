# AgentSocial 🤖

> **为 AI Agent 提供社交身份** —— 一个将本地 AI CLI（如 Gemini CLI, Claude Code）与社交平台（飞书等）无缝连接的智能网桥。

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

AgentSocial 是一个轻量级但功能强大的中间件，旨在让你通过熟悉的社交软件（如飞书、钉钉）远程、安全地管理本地项目。它不仅仅是一个简单的转发器，更是一个带有“安全审核机制”的 Agent 托管环境。

---

## ✨ 核心特性

- **🛡️ 安全可控：双阶段执行模式**
  - **计划阶段 (Plan)**: Agent 接收指令后，先生成详细的执行计划（要改哪些文件、执行什么命令）。
  - **确认阶段 (Auto)**: 计划以交互式卡片发送至手机，只有在你点击“确认”后，Agent 才会正式动手。
- **🔌 零成本内网穿透**
  - 基于飞书 WebSocket 模式，**无需公网 IP，无需配置 Webhook 地址**，只要你的电脑能上网，就能在全世界任何地方指挥它。
- **📱 多端实时同步 (New!)**
  - PC 端点击操作，手机端毫秒级同步状态。所有卡片操作均支持多设备一致性更新。
- **🧠 深度隔离：多会话环境管理**
  - 为每个群聊、每个用户自动创建独立的 `.gemini` 运行环境。历史记录、Token 消耗、Context 上下文完全隔离。
- **⚡ 智能预热 (Pre-warming)**
  - 启动时自动建立项目索引，确保 Agent 在响应你的第一条指令前已经“读过”项目代码，告别冷启动等待。
- **🖥️ 实时监控仪表盘**
  - 集成控制台 UI，实时展示各个 Bot 实例的在线状态、任务执行进度及错误日志。
- **🤖 多 Agent 引擎支持**
  - 原生支持 `Gemini CLI`，并预留了 `Claude Code` 与 `Codex` 的扩展接口。

---

## 🔄 工作流程 (How it Works)

1. **接收指令**：用户在飞书群或私聊中发送指令（如：`@机器人 帮我写个用户登录接口`）。
2. **计划生成**：Agent 进入 `Plan` 模式，分析代码库并输出预期的修改方案。
3. **卡片推送**：AgentSocial 将计划封装为飞书**可折叠详情卡片**推送到用户手机，长内容自动收起，界面更清爽。
4. **人工确认**：用户预览计划，点击“🚀 确认计划并开工”。
5. **自动执行**：Agent 进入 `Auto` 模式，在隔离环境中自动执行操作。
6. **结果回传**：执行成功后，回传详细的结果卡片（包含修改的文件或运行结果）。

---

## 🚀 快速开始

### 1. 系统要求
- [Node.js](https://nodejs.org/) v18.0.0 或更高版本。
- 已安装并登录 [Gemini CLI](https://github.com/google/gemini-cli) (或你选择的其他 Agent CLI)。
- 能够访问飞书开放平台。

### 2. 安装与构建
```bash
# 克隆并进入项目目录
git clone https://github.com/你的用户名/AgentSocial.git
cd AgentSocial

# 安装依赖
npm install

# 编译代码
npm run build

# (推荐) 建立全局命令链接，以便直接使用 agent-social 命令
npm link
```

### 3. 配置向导 (Setup)
在你的项目目录下执行：
```bash
agent-social setup
```
程序将引导你：
1. **自动检测** 本地 Agent 环境。
2. **输入** 飞书 App ID / Secret。
3. **一键诊断** 飞书后台权限配置是否正确（自动检测 Scopes 和事件订阅）。

### 4. 运行
```bash
agent-social run
```

---

## 🛠️ 指令表

| 指令 | 别名 | 说明 |
| :--- | :--- | :--- |
| `agent-social setup` | - | **交互式配置**。引导完成飞书应用对接与权限校验。 |
| `agent-social run` | (默认) | **启动服务**。根据 `config.json` 启动所有机器人实例。 |
| `agent-social -h` | `--help` | 显示帮助信息。 |

---

## ⚠️ 常见问题排查 (Troubleshooting)

### 1. 机器人无法接收消息 / 发送卡片失败
请检查飞书开发者后台：
- **启用机器人**: `应用功能` -> `机器人` -> `启用` (这是最常被遗漏的一步)。
- **发布应用**: 任何权限或事件订阅的修改，必须 **创建版本并发布** 才会生效。

### 2. 卡片显示 "Trigger Failed" 或返回错误码
- 这是由于网络延迟导致同步响应超时。
- **解决方案**: 我们已优化为“极速响应 + 异步更新”模式，请确保更新到最新代码并重新运行。

### 3. Agent 提示 "429 Too Many Requests"
- 这是 Gemini API 的速率限制。
- **建议**: 避免在 `Auto` 模式下一次性下达过于复杂的全项目重构指令。

---

## 📂 进阶管理

### 配置文件结构 (`config.json`)
AgentSocial 支持同时运行多个 Bot 管理不同的项目：
```json
[
  {
    "platform": "feishu",
    "app_id": "cli_xxxx",
    "app_secret": "xxxx",
    "agent_type": "gemini",
    "project_path": "D:/projects/my-web-app"
  }
]
```

### 运行环境隔离机制
- **存储位置**: `sessions/{app_id}/{chat_id}/`
- **机制**: 启动时自动从系统目录同步身份认证文件（如 `google_accounts.json`），确保 Agent 在隔离环境下依然拥有你的授权。

---

## 📜 开发者与贡献

### 开发模式
```bash
# 启动热更新开发环境
npm run dev

# 直接运行 setup 指令的开发版
npm run dev:setup

# 直接运行启动指令的开发版
npm run dev:run
```

### 架构设计
更多技术细节请参考 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 📄 开源协议
本项目遵循 [ISC License](./LICENSE)。