# 📚 CrowdFAQ

> A full-stack, **crowdsourced FAQ & Q&A platform** with AI assistance, real-time community features, gamification, and a resilient MongoDB‑first / SQLite‑fallback data layer.

CrowdFAQ lets communities collectively curate, vote on, and follow high‑quality answers. It ships with authentication, voting, bookmarks, follows, notifications, bounties, learning paths, AI‑powered chat, duplicate detection, analytics dashboards, and a GraphQL endpoint — all wrapped in a clean, responsive React UI.

---

## ✨ Features

### 🧠 Content & Community
- **Q&A + FAQs** — submit questions, post answers, mark resolutions, and curate long‑form FAQs.
- **Voting** — upvote/downvote questions and answers with persistent counts.
- **Bookmarks** — save questions and FAQs to read later.
- **Follows & Notifications** — follow topics/users and receive updates.
- **Hashtags & Trending** — discover what's popular via tag filters and a trending feed.
- **Anonymous Mode** — ask questions privately; opt‑in via middleware.
- **Duplicate Detection** — surfaces likely duplicates when posting a new question.
- **Bounties** — reward contributors for high‑quality answers.
- **Learning Paths** — curated topic journeys.

### 🤖 AI & Search
- **AI Chat Widget** — embedded contextual assistant (powered by `@google/genai`).
- **Recommendations** — server‑side suggestions based on activity.
- **Search Analytics** — track what's being searched.

### 📊 Dashboards & Insights
- **Activity Graph**, **Community Heatmap**, **Stats Grid** in the frontend.
- **Contributor Leaderboard** with badges (badge service on the backend).
- **Admin Panel** for moderation and site health.
- **Profile Dropdown** with personalized controls.

### 🛡️ Reliability & Security
- **Dual data store** — MongoDB (primary) with an automatic **SQLite fallback** so the API keeps working offline.
- **Bi‑directional sync** between MongoDB and SQLite.
- **JWT auth** with optional auth middleware for guest endpoints.
- **Role‑based ownership** (`requireAuth`, ownership middleware).
- **Rate limiting**, **helmet**, **compression**, **CORS**, request validation (**Zod**).
- **API docs** via OpenAPI 3 + Swagger UI at `/api/docs`.

---

## 🧱 Tech Stack

### Backend — `backend/`
| Concern        | Library |
|----------------|---------|
| Runtime        | Node.js (CommonJS) |
| Framework      | **Express 5** |
| Database       | **MongoDB** (Mongoose) + **SQLite 3** (fallback) |
| Auth           | JWT (`jsonwebtoken`), `bcryptjs` |
| Validation     | **Zod** |
| AI             | `@google/genai` |
| GraphQL        | `graphql` + custom routes |
| API Spec       | OpenAPI 3 (`swagger-ui-express`, `yamljs`) |
| Security/Misc  | `helmet`, `cors`, `compression`, `express-rate-limit`, `morgan`, `multer` |
| Imports/Export | `mammoth`, `pdf-parse`, `pdfkit`, `docx` |
| Testing        | **Jest** + **Supertest** |

### Frontend — `frontend/` (CrowdFAQ React)
| Concern        | Library |
|----------------|---------|
| Framework      | **React 19** |
| Build Tool     | **Vite 8** |
| Routing        | **react-router-dom 7** |
| Styling        | CSS Modules + global theme (`ThemeProvider`, light/dark) |
| Icons          | `lucide-react` |
| Charts         | **Chart.js** + `react-chartjs-2` |
| Lint           | ESLint + react-hooks plugin |

### Repository Layout
```
FAQE/
├── backend/                       # Express API server
│   ├── server.js                  # App bootstrap
│   ├── db/                        # Mongo + SQLite connectors, migrations
│   ├── models/                    # Mongoose models (FAQ, Answer, Vote, etc.)
│   ├── routes/                    # 22 feature routes (faqs, votes, ai, etc.)
│   ├── services/                  # Business logic (sync, decay, AI, badges, ...)
│   ├── middleware/                # auth, validate, errorHandler, rateLimits
│   ├── migrations/                # number‑prefixed data migrations
│   ├── tests/                     # Jest + Supertest test suites
│   ├── utils/                     # helpers (pagination, apiResponse, ...)
│   └── openapi.yaml               # API specification
│
├── frontend/                      # React + Vite client (CrowdFAQ)
│   ├── public/                    # static assets + landing.html + widget.js
│   ├── src/
│   │   ├── api/                   # faqApi client
│   │   ├── components/            # Sidebar, ChatWidget, TrendingQ, etc.
│   │   ├── context/               # Theme, Auth, FAQ, Follow providers
│   │   ├── pages/                 # Dashboard, Questions, FAQDetail, ...
│   │   ├── styles/                # global CSS
│   │   └── utils/                 # time helpers, etc.
│   ├── vite.config.js
│   └── README.md                  # legacy Vite template README
│
└── README.md                      # ← you are here
```

---

## 🔌 API Surface (high‑level)

The backend exposes REST + a GraphQL endpoint. Some highlights:

| Method | Path                          | Purpose                              |
|--------|-------------------------------|--------------------------------------|
| GET    | `/health`                     | Service + DB health                  |
| GET    | `/health/persistence`         | Inspect Mongo/SQLite counts (dev)    |
| POST   | `/api/auth/...`               | Sign up / log in (JWT)               |
| GET    | `/api/faqs` · POST `/api/faqs`| List & create FAQs                   |
| GET    | `/api/queries` · POST         | List & submit user queries           |
| PATCH  | `/api/queries/:id/resolve`    | Resolve a query                      |
| POST   | `/api/answers`                | Post an answer                       |
| POST   | `/api/votes`                  | Toggle a vote (Q or A)               |
| GET    | `/api/bookmarks`              | List bookmarks                       |
| GET/POST | `/api/follows`              | Follows                              |
| GET    | `/api/notifications`          | User notifications                   |
| GET    | `/api/contributors`           | Leaderboard                          |
| GET    | `/api/stats`                  | Aggregated stats                     |
| POST   | `/api/search`                 | Search                               |
| POST   | `/api/recommendations`        | Recommended content                  |
| GET    | `/api/learning-paths`         | Learning paths                       |
| POST   | `/api/duplicates`             | Duplicate detection                  |
| POST   | `/api/chat`                   | AI chat                              |
| POST/GET | `/api/graphql`             | GraphQL endpoint                     |
| POST   | `/api/bounties`               | Bounty system                        |
| POST   | `/api/export`                 | Export (PDF/DOCX)                    |
| GET    | `/api/docs`                   | Swagger UI (OpenAPI 3)               |
| GET    | `/api/admin`                  | Admin operations (auth required)     |
| POST   | `/api/reports`                | Content reporting                    |

> Full schema is in `backend/openapi.yaml`.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js ≥ 18** (project is built and tested on modern Node)
- **npm** (or pnpm/yarn)
- **MongoDB** instance (local or Atlas). If MongoDB is unreachable, the app transparently uses **SQLite** as a fallback.

### 1) Backend

```bash
cd backend
npm install
# Optional: create a .env file (see Environment Variables below)
npm run dev           # development mode (NODE_ENV=development)
# or
npm start             # production mode
```

By default the API listens on `http://localhost:5000`.

Quick health checks:
```bash
curl http://localhost:5000/
curl http://localhost:5000/health
curl http://localhost:5000/health/persistence
```

API documentation:
- Swagger UI: `http://localhost:5000/api/docs`
- Spec file: `backend/openapi.yaml`

### 2) Frontend

```bash
cd frontend
npm install
npm run dev           # starts Vite dev server (default: http://localhost:5173)
npm run build         # production build
npm run preview       # preview built site
npm run lint          # ESLint
```

The frontend expects the backend at `http://localhost:5000` (override via `CORS_ORIGIN`).

### Running Tests (Backend)

```bash
cd backend
npm test              # Jest in band
```

---

## ⚙️ Environment Variables

Create `backend/.env`:

```env
# Server
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# MongoDB (primary store)
MONGODB_URI=mongodb://127.0.0.1:27017/crowdfaq
# For Atlas, also make sure DNS is resolvable
# (server.js pins Google DNS as a safety net)

# SQLite fallback
SQLITE_PATH=./faq_fallback.sqlite

# Auth
JWT_SECRET=replace_me_with_a_strong_secret

# AI (Google GenAI)
GOOGLE_API_KEY=your_google_genai_key

# Rate limiting (optional)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
```

> ⚠️ Never commit `.env`. It's already covered by the project's `.gitignore`.

---

## 🗄️ Data Model (selected)

The backend defines Mongoose models in `backend/models/`, including:

- **FAQ** — community‑curated FAQs with revisions.
- **UserQuery** — the question side of Q&A, with status + views.
- **Answer** · **AnswerRevision**
- **Vote** — per‑user voting record.
- **Bookmark**
- **Follow** — relationships between users/tags.
- **Notification** · **NotificationPreference**
- **LearningPath** · **Bounty** · **DuplicateLink**
- **ModerationRecord** · **ChatLog** · **Event** · **SearchAnalytic**
- **User**

A SQLite mirror is maintained for offline operation via `services/syncService.js`. Numbered migrations live under `db/migrations/` and `migrations/`.

---

## 🧑‍💻 Frontend Routes

| Path                  | Page             |
|-----------------------|------------------|
| `/`                   | Landing          |
| `/dashboard`          | Dashboard        |
| `/questions`          | Questions feed   |
| `/questions/:id`      | Question detail  |
| `/faqs`               | FAQ listing      |
| `/faqs/:id`           | FAQ detail       |
| `/categories`         | Categories       |
