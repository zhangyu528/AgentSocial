# Architecture & Technical Design

This document describes the internal workings of AgentSocial and how it manages AI Agent sessions.

## 1. Session Isolation Mechanism

AgentSocial ensures that every chat session (Group or P2P) has a completely isolated environment. This prevents cross-talk between different users or projects.

- **Storage Path**: `~/.agentsocial/sessions/{app_id}/{md5(chat_id)}/`
- **Path Sanitization**: The `chatId` is hashed using MD5 before creating directory paths to prevent Path Traversal attacks.
- **Agent Home**: The `GEMINI_CLI_HOME` environment variable is strictly routed to the session directory.
- **Symlink Sync**: Instead of copying, AgentSocial uses **symbolic links** to share global auth files (`google_accounts.json`, etc.) from `~/.gemini/`. This ensures a single source of truth for credentials and prevents credential sprawl. 
- **Security Fallback**: On platforms where symlinks may fail (e.g., Windows without admin rights), it falls back to copying with strict OS-level permissions (`0o600`).

## 2. Two-Stage Execution Pipeline

To ensure safety and predictability, AgentSocial implements a two-stage pipeline for all incoming commands.

### Stage 1: Planning (`plan` mode)
- **Goal**: Analyze the project and propose a plan without any ability to modify the filesystem.
- **Native Sandboxing**: The agent is executed with `--approval-mode plan`. This is a CLI-level **Hard Read-Only Sandbox** that strips all write-access tools from the model.
- **Prompt Isolation**: AgentSocial reinforces this with a prompt suffix: `(Please only output a detailed execution plan text. Do not execute any tools yet.)`.
- **Outcome**: Captured output is sent as an interactive "Plan Confirmation" card.

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

## 5. Security Hardening

- **Global Secret Storage**: All sensitive credentials (Feishu app secrets) are stored in `~/.agentsocial/settings.json`, removing them from the project repository.
- **Command Injection Prevention**: All CLI commands are executed via array-based `spawn` arguments with `shell: false`, treating user input as literal text rather than shell instructions.
- **Fail-Closed Access**: Access control defaults to restricted mode if API calls to the authorization service fail.
- **macOS Compatibility**: Automatic handling of platform-specific binary wrappers (like `.cmd` on Windows) ensures clean execution across environments.
