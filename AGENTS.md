# AI Developer Agent Guide (`AGENTS.md`)

This document serves as an entrypoint for AI coding assistants working on this repository. It defines our development workflows, code organization, testing protocols, and project rules.

---

## 1. Project Context & Purpose

- **Project Name**: NovaCMS
- **Description**: A lightweight, proof-of-concept Content Management System (Joomla/WordPress-style). It consists of a server-side rendered (SSR) public website with customizable layouts and dynamic themes, and a secure Single Page Application (SPA) administrator console for page CRUD and system metadata settings.
- **Key Repositories**:
  - Main App: `https://github.com/FXHibon/poc-cms`
  - Infrastructure: `https://github.com/fxhibon/iac`

---

## 2. Technology Stack

- **Runtime & Language**: Node.js v26.0 (CommonJS)
- **Web Framework**: Express v4.19 (with EJS templates for public SSR)
- **Database**: PostgreSQL 18 (configured via Docker Compose)
- **Dependency Manager**: npm v11.12
- **Testing Framework**: Native Node.js Test Runner (`node --test`)
- **Authentication**: JWT cookies (HTTP-Only, SameSite strict, cryptographically signed)

---

## 3. Directory Layout

```text
├── .github/                 # GitHub Actions workflows & Dependabot config
│   └── workflows/ci.yml     # Automated Docker build & push workflows
├── .gemini/                 # Custom AI Agent skills and templates
├── public/                  # Static assets
│   └── admin/               # Administrator panel (SPA)
│       ├── index.html       # Dashboard console layout
│       ├── login.html       # Portal credentials login layout
│       ├── admin.css        # Dashboard styling system
│       └── admin.js         # AJAX API and DOM controller
├── src/                     # Application source code
│   ├── db/                  # Database connectivity and migrations
│   │   ├── index.js         # pg connection pool client
│   │   ├── init.js          # DB schema migration and administrator seed runner
│   │   └── init.sql         # Table schemas and initial config seeds
│   ├── views/               # EJS template views (SSR Public Site)
│   │   ├── header.ejs       # Shared head meta, styles and nav header
│   │   ├── footer.ejs       # Shared closing tags and footnote layout
│   │   ├── page.ejs         # Article renderer
│   │   └── error.ejs        # Error / 404 handler EJS
│   └── server.js            # Express API and routes implementation
├── tests/                   # Integration and Unit tests
├── Dockerfile               # Production multi-stage Docker build
├── docker-compose.yml       # Local development environment (App + Postgres)
├── docker-compose.test.yml  # Integration testing orchestration
├── README.md                # General developer readme guide
└── AGENTS.md                # THIS FILE (AI Agent guidance)
```

---

## 4. Key Developer Commands

When executing tasks, use the exact commands listed below. Do not guess or run custom wrappers unless instructed by the user.

- **Start Dev Server (Local Host)**: `npm run dev`
- **Initialize/Reset Database**: `npm run init-db`
- **Run Unit/Integration Tests**: `npm test`
- **Run Integration Tests (Docker Compose)**: `docker compose -f docker-compose.test.yml up --build --exit-code-from app`
- **Start Local Env (Docker Compose)**: `docker compose up --build`

---

## 5. Architectural & Code Style Patterns

- **Coding Standard**: CommonJS (`require`), vanilla JavaScript ES6. Avoid experimental runtime flags. Keep code highly readable and preserve docstrings.
- **Error Handling**: Throw descriptive errors in database controllers. Return JSON payloads `{ error: "message" }` in backend APIs with suitable HTTP statuses (400, 401, 404, 500). Render `error.ejs` for public route rendering exceptions.
- **Client Side Dialog Modals**: Use native HTML `<dialog>` with `closedby="any"` attribute. Always implement coordinate-based boundary click fallback scripts in `admin.js` for Safari compatibility.
- **Dynamic CSS variables**: Read settings (like accent color) from PostgreSQL on server boot, and inject them into EJS CSS roots to allow real-time client customizable branding.
- **Git Strategy**: Keep commits small, descriptive, and prefix them with conventional tags (e.g. `feat:`, `fix:`, `refactor:`, `docs:`).

---

## 6. Testing & CI/CD Guidelines

- **Unit Testing**: Stub external network requests or database connectivity where necessary.
- **Integration Testing**: Spin up containers via `docker-compose.test.yml` to run tests against the transient PostgreSQL image. Ensure tables are seeded using `init.js` in the entry sequence.
- **CI/CD Compliance**: Every commit to `master` must successfully build and pass the status check `docker-build / Build & Push Docker Image` defined in `.github/workflows/ci.yml`.
