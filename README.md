# Real-Time Chat Application with GoLang

## Objective:

Develop a real-time chat application using GoLang for server-side processing, WebSockets for real-time communication, and PostgreSQL for data persistence.

## Tech Stack:

GoLang
PostgreSQL

## Key Learnings/Patterns:

Real-time communication with WebSockets
Concurrency and multi-threading in GoLang
Handling high-load environments with lightweight GoLang architecture

## Left to do - issues:

- Sometimes "Members" for channel shows duplicates?
- Channel deletion not working consistently...sometimes we get 200 OK and WS update, but DB fails to delete, sometimes no WS update, sometimes 500 ERR ...
- Message flush error: 2025/03/17 16:32:31 Error flushing messages: failed to insert message: pq: insert or update on table "messages" violates foreign key constraint "messages_channel_name_fkey"
