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
- **🧠 深度隔离与权限：多会话与安全认证管理**
  - 为每个会话自动创建**硬隔离**的运行环境。
  - **凭证同步**: 通过符号链接（Symlink）安全共享全局 Google 认证，避免凭证扩散。
  - **访问控制**: 自动同步飞书“应用可见范围”，采用 **Fail-Closed** 安全策略，只有授权成员才能控制。
- **📢 状态感知：智能广播通知**
  - 机器人上线/下线时，自动向群组及“可见范围”内的成员推送私聊通知，确保相关成员第一时间获知 Agent 状态。
- **⚡ 智能预热 (Pre-warming)**
  - 启动时自动建立项目索引，确保 Agent 在响应指令前已快速就绪。
- **🤖 多 Agent 引擎支持**
  - 深度集成 `Gemini CLI`，并提供 `Claude Code` 与 `Codex` 的扩展指引。
- **🍎 跨平台兼容**
  - 完美支持 **macOS** 与 **Windows**，自动处理平台差异（如 Windows .cmd 文件包装）。

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

### 2. 安装

通过 [GitHub CLI](https://cli.github.com/) 验证并安装：

```bash
# 1. 登录 GitHub
gh auth login

# 2. 刷新权限以支持读取 Packages
gh auth refresh -s read:packages

# 3. 配置 npm auth token
npm config set //npm.pkg.github.com/:_authToken=$(gh auth token)

# 4. 全局安装
npm install -g @zhangyu528/agentsocial --@zhangyu528:registry=https://npm.pkg.github.com
```

### 3. 配置向导 (Setup)
在任意终端执行：
```bash
agentsocial setup init
```
程序将引导你：
1. **智能检测**: 自动探测本地是否安装了 Gemini CLI 等 Agent 环境，并给出详细安装建议。
2. **输入**: 录入飞书 App ID / Secret。
3. **一键诊断**: 自动验证飞书权限配置、Scopes 和事件订阅。
4. **全球化存储**: 配置文件与会话数据安全地存储在用户主目录 `~/.agentsocial/` 中。

### 4. 运行
```bash
agentsocial run
```

运行后，您可以通过以下方式开始：
- **直接私聊**: 您可以直接在飞书私聊框输入指令，无需 @ 机器人。
- **拉我入群**: 将机器人拉入您的项目群，并通过 @我 的方式下达指令。
- **任务审批**: 机器人会先回传执行计划，待您点击“批准”按钮后它将正式动工。

---

## 🛠️ 指令表

| 指令 | 别名 | 说明 |
| :--- | :--- | :--- |
| `agentsocial setup init` | - | **交互式配置**。引导完成飞书应用对接与权限校验。 |
| `agentsocial run` | (默认) | **启动服务**。根据 `config.json` 启动所有机器人实例。 |
| `agentsocial -h` | `--help` | 显示帮助信息。 |

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

### 配置文件存储 (`settings.json`)
AgentSocial 的配置现在存储在全局目录 `~/.agentsocial/settings.json` 中，确保密钥不随项目源码泄露：
```json
[
  {
    "platform": "feishu",
    "app_id": "cli_xxxx",
    "app_secret": "xxxx",
    "agent_type": "gemini cli",
    "project_path": "D:/projects/my-web-app"
  }
]
```

---

## ⚠️ 飞书权限复核清单

若机器人无法接收消息或发送卡片，请检查飞书开发者后台：

1.  **启用机器人**: 应用功能 -> 机器人 -> 启用
2.  **核心权限 (Scopes)**:
    - `im:message:readonly` (获取单聊、群组消息)
    - `im:message.p2p_msg:readonly` (读取用户发给机器人的单聊消息)
    - `im:message.group_at_msg:readonly` (接收群聊中@机器人消息事件)
    - `im:message:send_as_bot` (以应用的身份发送消息)
    - `im:chat:readonly` (获取群组信息)
    - `admin:app.info:readonly` (获取应用信息)
3.  **事件订阅**:
    - 添加 `接收消息 (im.message.receive_v1)`。
4.  **卡片回调**:
    - 开启 `消息卡片操作 (card.action.trigger)`。
5.  **发布**:
    - 记得 **创建版本并发布**，所有修改才会生效。

---

## 📜 开发者与贡献

### 开发模式
```bash
# 通过 CLI 查看帮助
npm run cli -- -h

# 通过 CLI 运行 setup init
npm run cli -- setup init

# 通过 CLI 运行服务
npm run cli -- run
```

### 架构设计
更多技术细节请参考 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 📄 开源协议
本项目遵循 [ISC License](./LICENSE)。
