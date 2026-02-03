# AgentSocial

Giving AI Agents a social identity. A unified bridge for sending notifications to social platforms (Feishu, DingTalk, etc.) and receiving commands back.

## Scripts

- `src/feishu-api.ts`: Central API service using official Lark SDK.
- `src/notify.ts`: Command-line tool to send notifications.
- `src/main.ts`: The primary application entry point (agent with session resume).
- `src/watcher.ts`: A simpler command-polling service.

## Installation

```bash
npm install
```

## Configuration

Place your credentials in `config.json` in the root of this project:

```json
{
  "app_id": "your_app_id",
  "app_secret": "your_app_secret",
  "receive_id": "optional_chat_id",
  "receive_id_type": "chat_id"
}
```

> [!TIP]
> **Dynamic Discovery**: If `receive_id` is left empty, the application will automatically discover all chats the bot has joined and send notifications to all of them. For incoming commands, the bot will always reply to the source chat regardless of this configuration.

## Running (Development)

To start the application:
```bash
npm start
```

## Building (Production)

To compile to JavaScript:
```bash
npm run build
```
The output will be in the `dist` folder.
