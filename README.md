# AgentSocial

为 AI Agent 提供社交身份。一个统一的桥梁，用于通过社交平台（目前支持飞书）远程管理你的本地项目、接收通知并执行指令。

## 🌟 核心特性

- **多 Agent 兼容**: 同时支持 `Google Gemini`、`Claude Code` 和 `Codex` 等多种 CLI 智能体。
- **智能环境检测**: 自动识别本地已安装的 AI 工具，引导完成配置。
- **WebSocket 实时响应**: 无需公网 IP，内网穿透，毫秒级响应。
- **多会话隔离**: 每个群聊拥有独立的对话记忆和文件空间，互不干扰。
- **安全沙箱**: 可选的沙箱模式，保护宿主机系统安全。
- **可靠性保障**: 启动前自动进行依赖自检，确保环境就绪。

---

## 🚀 快速开始

### 1. 安装

确保你的电脑已安装 [Node.js](https://nodejs.org/) (v18+)。

**通过 GitHub 安装**
```bash
npm install -g git+https://github.com/你的用户名/AgentSocial.git
```

### 2. 注册与配置

进入你想要让 AI 协助管理的**项目目录**，运行注册命令：

```bash
agent-social register
```

程序将进入交互式向导：
1. **检测环境**: 自动列出本地已安装的 Agent (Gemini/Claude/Codex)。
2. **选择工具**: 选择你想要为该应用分配的 AI 核心。
3. **填入凭据**: 输入飞书应用的 `App ID` 和 `App Secret`。
4. **安全设置**: 选择是否开启沙箱模式。

*重复运行 `agent-social register` 可以为一个项目挂载多个不同的机器人。*

### 3. 启动服务

在项目目录下运行：

```bash
agent-social run
```
*(提示：直接运行 `agent-social` 不带参数，默认效果等同于 `run`)*

---

## 💬 指令说明

| 指令 | 说明 |
| :--- | :--- |
| `agent-social register` | **核心指令**。用于初始化配置文件或追加新的机器人配置。 |
| `agent-social run` | **启动指令**。启动所有已配置的机器人实例。 |
| `agent-social --help` | 查看帮助信息。 |

---

## 🛠️ 进阶管理

### 配置文件 (`config.json`)

注册完成后，目录下的 `config.json` 将记录如下信息：
```json
[
  {
    "app_id": "cli_xxxx",
    "app_secret": "xxxx",
    "agent_type": "gemini",  // gemini, claude, 或 codex
    "sandbox": true,
    "project_path": ""       // 默认为程序运行目录
  }
]
```

### 运行环境隔离

程序会自动在当前目录下维护会话状态：
- `sessions/{app_id}/{chat_id}/.gemini/`: 存储特定聊天窗口的上下文记忆。

### 依赖检查

每次启动 `run` 时，AgentSocial 都会检查：
- 配置文件中指定的 Agent（如 `claude`）是否已在系统路径中。
- 如果缺失，将打印安装指引并停止启动，确保服务运行的可靠性。