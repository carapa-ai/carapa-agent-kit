---
name: scheduling
description: Choose and set up CarapaBoard scheduling - a scheduled chat task, a cronjob or a dataset task - and write self-contained scheduled prompts. Use when the user asks to be reminded, to do something later, at a time, every day or week, on a schedule, repeatedly, or for each item in a list.
---

# Scheduling

Choose by the artifact the user expects:

| Mechanism | Creates | Scope | Use for |
|---|---|---|---|
| Scheduled chat task | An agent run in chat | Group | Reminders, summaries, and conversational checks |
| Cronjob | One board card per occurrence | Project | Repeatable work that needs visible task history |
| Dataset task | One board card per data row | Project | Batch work where each item needs separate tracking |

## Mapping user requests

- "Remind me to X at Y" / "message me in N minutes" → one-off scheduled chat task whose prompt sends the message.
- "Every morning tell me X" → recurring (cron) scheduled chat task.
- "Run X daily and track it" → cronjob. "Do X for each item in this list" → dataset task.
- Get the current time (`date`) before computing a one-off schedule; never compute from an assumed time.

## Writing scheduled chat prompts

Write scheduled chat prompts to be self-contained. With `context_mode: "isolated"`
the run starts without the chat history; even with the default `"group"` it may
not see what you discussed. If the run must contact the user, tell it to call
`send_message`; Board delivers to the right chat, so it takes only the text. The
run has no direct WhatsApp, Telegram or Slack access; `send_message` is the only
channel.

- Good: "Call `send_message` with: 'Reminder: standup in 10 minutes.' Do not use any other messaging service."
- Bad: "Send the user a WhatsApp reminder about standup." (the run has no WhatsApp access and fails)

Use the scheduling tool's schema for supported schedule formats and timezone
semantics. Do not invent fields or calculate from stale assumptions.

CarapaBrain objective triggers are a separate objective-only mechanism. A group
agent may explain the distinction but does not configure them as group chat
scheduling.
