# HabitQuest

A multiplayer RPG where your real-world habits power your character. Log your gym sessions, sleep, studying, and more — and watch your stats grow in a shared pixel-art world.

![Stack](https://img.shields.io/badge/React-Vite-blue) ![Phaser](https://img.shields.io/badge/Phaser-3.87-green) ![Node](https://img.shields.io/badge/Node.js-Express-yellowgreen) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue) ![Socket.io](https://img.shields.io/badge/Socket.io-realtime-black)

---

## What It Does

- **Log habits → gain stats.** Gym hours build Strength. Walking distance builds Agility. Sleep builds Vitality. Study time builds Intelligence. Every stat maps to a real behavior.
- **Walk around a shared town** with other players in real time. See their characters move, watch their usernames float above them.
- **Chat with other players** via an MMO-style chat overlay. Messages appear in the panel and as speech bubbles above players' heads.
- **Enter buildings** — visit the General Store to spend Gold on potions and stat boosts, the Tailor to change your character's appearance, or Town Hall to see your full stat breakdown.
- **Leaderboard** ranks all players by level and total stats.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Phaser.js 3.87 |
| Realtime | Socket.io (WebSockets) |
| Backend | Node.js + Express |
| Database | PostgreSQL 16 (Docker) |
| Auth | JWT (jsonwebtoken) |
| Deployment | Docker Compose |

---

## Habit → Stat Formula

| Habit | Unit | Stat | Formula |
|---|---|---|---|
| Gym / Workout | hours/week | Strength | hours × 5 |
| Walk / Run | km/week | Agility | km × 2 |
| Sleep | hours/week | Vitality | (hours / 56) × 100 |
| Water | glasses/week | Constitution | glasses (target: 56) |
| Study | hours/week | Intelligence | hours × 3 |
| Reading | hours/week | Wisdom | hours × 4 |
| Meditation | min/week | Focus | minutes |
| Money Saved | dollars | Gold | direct (no cap) |

**Level** = floor((STR + AGI + VIT + CON + INT + WIS + FOC) / 70) + 1

---

## Features

- **Real-time multiplayer** — movement synced via Socket.io with stale-socket deduplication on reconnect
- **JWT authentication** — register, login, persistent sessions
- **Character customization** — choose from 4 LPC-style pixel art sprites
- **Shop system** — buy Speed Potions, stat boosts, and mystery items using in-game Gold
- **MMO chat** — send messages that appear in the chat log and as floating bubbles above players
- **Town Hall stat panel** — full breakdown of all stats with progress bars and the formula behind each
- **Leaderboard** — ranked view of all players

---

## Running Locally

**Prerequisites:** Node.js 18+, Docker

```bash
# 1. Clone the repo
git clone <repo-url>
cd habitquest

# 2. Start the database
docker compose up -d postgres

# 3. Start the server
cd server
cp .env.example .env   # edit JWT_SECRET
npm install
npm run dev

# 4. Start the client (new terminal)
cd client
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), register an account, log some habits, and enter the world.

---

## Project Structure

```
├── client/               # React + Phaser frontend
│   └── src/
│       ├── game/
│       │   └── scenes/   # TownScene, InteriorScene, UIScene
│       ├── pages/        # React pages (Login, Habits, Game, Leaderboard...)
│       └── components/   # ChatOverlay
├── server/               # Express + Socket.io backend
│   └── src/
│       ├── routes/       # auth, habits, characters, shop
│       ├── socket/       # multiplayer handlers
│       └── db/           # schema.sql
└── docker-compose.yml
```

---

## Roadmap

- [ ] Deployment (Railway + Vercel)
- [ ] More habit → world visual effects (AGI → animation speed, etc.)
- [ ] Combat / PvE encounters
- [ ] Player housing
