# AgentSocial 功能驱动测试方案

该方案将测试体系按核心功能模块（`setup` 和 `run`）进行组织，涵盖单元测试、集成测试以及沙箱模拟。

## 1. `setup` 功能测试方案 (配置与初始化)

### 单元测试 (Unit Tests)
- **Agent 环境检测**: 测试 `detectAgent()` 逻辑，确保能正确识别本地已安装的 Gemini CLI、Claude Code 或 Codex。
- **配置持久化**: 测试 `settings.json` 的读写、格式验证以及在缺失时的默认值生成。
- **凭证验证**: 测试飞书 `app_id` 和 `app_secret` 的基础格式校验逻辑。

### 集成测试 (Integration Tests)
- **一键诊断模拟**: 使用 Mock 模拟飞书 `diagnose` 接口，验证在 Scopes 缺失、事件订阅未开启、机器人未启用等各种异常组合下，系统是否能给出正确的安装建议。
- **目录权限初始化**: 验证在不同操作系统（Win/macOS）下，`~/.agentsocial` 目录的创建及安全权限设置。

### 沙盒模拟 (Sandbox Simulation)
- **纯净环境模式**: 模拟一个没有任何 Agent 安装的系统，验证 `setup` 向导是否能正确引导用户并给出安装链接。
- **半就绪处理**: 模拟 Node 环境存在 but Agent CLI 损坏的情况，测试修复建议的准确性。

---

## 2. `run` 功能测试方案 (服务运行与指令流)

### 单元测试 (Unit Tests)
- **指令精准分拣**: 测试解析飞书多行、包含 @机器人 的混合消息，确保提取出的 Agent 命令无杂质。
- **Session 强隔离**: 验证 `MD5(chatId)` 生成规则；针对凭证同步，测试 Symlink 软链创建及其在 Win 环境下的 Copy 回退逻辑。
- **Fail-Closed 审计**: 模拟鉴权服务异常，验证系统是否能严格执行“不确定即拒绝”的安全策略。

### 集成测试 (Integration Tests)
- **WS 事件循环**: 模拟飞书 WebSocket 接收到 `im.message.receive_v1` 事件，验证系统是否能自动定位或创建对应的隔离 Session 并进入 `Plan` 阶段。
- **两阶段状态机**: 模拟飞书卡片 `card.action.trigger` 回调，验证从 `Plan` (只读) 状态向 `Auto` (YOLO) 状态转换的正确性。

### 沙盒模拟 (Sandbox Simulation)
- **Agent 命令全链路**: 模拟用户发送“帮我查看项目”，验证系统最终调用的命令是否包含严格的 `--approval-mode plan` 标识。
- **执行结果回填**: 模拟 Agent CLI 返回标准输出或报错，验证网桥是否能捕获输出并无损转化为飞书详情卡片。
- **故障反馈环验证**: 故意注入代码 Bug，运行测试，验证 `AgentReporter` 是否能吐出带上下文的诊断书。

---

## 拟议变更

### [AgentSocial](file:///d:/work/project/AgentSocial)

#### [MODIFY] [package.json](file:///d:/work/project/AgentSocial/package.json)
- [NEW] 添加开发依赖: `jest`, `ts-jest`, `@types/jest`, `husky`, `nock`.
- [NEW] 添加脚本: `"test": "jest"`.

#### [NEW] [src/__tests__/setup-functional.test.ts](file:///d:/work/project/AgentSocial/src/__tests__/setup-functional.test.ts)
- 覆盖 `setup` 核心功能点。

#### [NEW] [src/__tests__/run-functional.test.ts](file:///d:/work/project/AgentSocial/src/__tests__/run-functional.test.ts)
- 覆盖 `run` 核心指令流与沙盒逻辑。

---

## 3. 发布前检查要求 (Coverage + Checklist)

- Coverage 报告: 执行 `npm run test:coverage`，确认覆盖率报告生成且关键模块无明显回退。
- 功能测试清单: 执行并勾选 `tests/docs/FUNCTIONAL_TEST_CHECKLIST.md` 中条目，作为发布前功能验证记录。
- 发布门禁建议: 覆盖率和功能清单必须同时通过，任一失败则阻断发布。
