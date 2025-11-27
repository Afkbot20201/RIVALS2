
# Rivals 2 – Node Multiplayer Shooter

Simple real-time multiplayer top-down shooter built with **Node.js**, **Express**, and **Socket.IO**, with a modern neon-dark UI. Includes room creation, joining, and host-controlled game start. Designed to run locally and on **Render** as a single Node service.

## Features

- Create / join rooms with short room codes
- Host-controlled **Start Game**
- Real-time movement and shooting over WebSockets
- Server-side game loop with basic hit detection and respawns
- Modern dark UI with smooth transitions and a responsive layout
- Single Node app serving both API + static front-end

## Local setup

```bash
npm install
npm start
```

Then open your browser at:

- http://localhost:3000

Open the URL in multiple tabs or share on LAN to play together.

## Deploying to Render

1. Push this repo to GitHub.
2. In Render, create a new **Web Service** from your GitHub repo.
3. Use:
   - **Environment**: Node
   - **Build command**: `npm install`
   - **Start command**: `npm start`
4. Wait for deploy and then visit the Render URL – the game should load.

Socket.IO uses the same HTTP service, so you don’t need a separate WebSocket service.

## Controls

- **WASD** – Move
- **Mouse** – Aim
- **Mouse click** – Shoot

## Notes

- This is intentionally compact and easy to understand, not a fully optimized shooter engine.
- You can tweak arena size and speeds in `server.js`:
  - `ARENA_WIDTH`, `ARENA_HEIGHT`
  - `PLAYER_SPEED`
  - `BULLET_SPEED`
  - `PLAYER_MAX_HP`, `BULLET_DAMAGE`
- UI styles live in `public/style.css`.
- Client-side logic is in `public/client.js`.


New Features Added:
- Lobby Chat
- Kill Feed (Server side)
- Teams & Colors
- Power-Ups
- Match Timer & Win Screen
- Roblox-inspired Hub UI
