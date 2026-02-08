# Architecture & Technical Design

This document describes the internal workings of AgentSocial and how it manages AI Agent sessions.

## 1. Session Isolation Mechanism

AgentSocial ensures that every chat session (Group or P2P) has a completely isolated environment. This prevents cross-talk between different users or projects.

- **Storage Path**: `sessions/{app_id}/{chat_id}/`
- **Agent Home**: The `GEMINI_CLI_HOME` (or equivalent) environment variable is set to the session directory.
- **State Sync**: Upon session initialization, AgentSocial copies global authentication files (like `google_accounts.json`, `installation_id`, etc.) from the user's home directory to the session's `.gemini` folder. This allows the isolated agent to maintain the user's identity while keeping history separate.

## 2. Two-Stage Execution Pipeline

To ensure safety and predictability, AgentSocial implements a two-stage pipeline for all incoming commands.

### Stage 1: Planning (`plan` mode)
- **Goal**: Understand the user's intent and propose a set of actions without executing them.
- **Command Injection**: AgentSocial appends a suffix to the user's prompt: `(Please only output a detailed execution plan text. Do not execute any tools yet.)`.
- **Approval Mode**: The agent is run with `--approval-mode default` (or similar strict mode) to prevent accidental tool execution during the planning phase.
- **Outcome**: The agent's output is captured and sent back to the user as a "Plan Confirmation" card.

### Stage 2: Execution (`auto` mode)
- **Goal**: Execute the confirmed plan autonomously.
- **Trigger**: The user clicks the "Confirm" button on the Feishu card.
- **Resume Logic**: The agent is run with `--resume latest` inside the same session directory. This ensures it remembers the plan it just proposed.
- **YOLO Mode**: Since the user has already approved the plan, the agent runs in `--yolo` mode to execute tools without further interactive prompts.
- **Outcome**: The final execution result (stdout/stderr) is summarized and sent as a "Result Card".

## 3. Platform Integration (Feishu)

- **WebSocket (Long Polling)**: AgentSocial uses the `@larksuiteoapi/node-sdk` WSClient. This avoids the need for public IP addresses or complex webhook configurations.
- **Event Dispatcher**: 
    - `im.message.receive_v1`: Handles new text messages.
    - `card.action.trigger`: Handles button clicks from Plan Cards or Approval Cards.
- **Health Diagnosis**: Before starting, the bot performs a "Pre-flight Check" via `api.diagnose()` to ensure all required Scopes and Events are active on the Feishu Developer Console.

## 4. Pre-warming

When a bot starts, it executes a silent "Pre-warm" task:
`gemini --include-directories "." -p "list the project root files briefly"`

This forces the underlying Agent to index the current project, so the first user command is processed much faster.
