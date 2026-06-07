# AI Developer Agent Guide (`AGENTS.md`)

This document serves as an entrypoint for AI coding assistants working on this repository. It defines our development workflows, code organization, testing protocols, and project rules.

---

## 1. Project Context & Purpose

- **Project Name**: `<Name of the application>`
- **Description**: `<2-3 sentences explaining what this application does, who the users are, and its business value.>`
- **Key Repositories**:
  - Main App: `https://github.com/<org>/<repo>`
  - Infrastructure: `https://github.com/fxhibon/iac`

---

## 2. Technology Stack

- **Runtime & Language**: `<e.g. Node.js v20 (TypeScript), Go 1.22, Python 3.11>`
- **Web Framework**: `<e.g. Express, Gin, FastAPI>`
- **Database**: `<e.g. PostgreSQL 15, Redis 7 (caching)>`
- **Dependency Manager**: `<e.g. npm, go mod, poetry>`
- **Testing Framework**: `<e.g. Jest, native go test, pytest>`

---

## 3. Directory Layout

```text
├── .github/                 # GitHub Actions workflows & Dependabot config
├── .gemini/                 # Custom AI Agent skills and guidelines
├── src/                     # Application source code
│   ├── config/              # Configuration loader & environment schemas
│   ├── controllers/         # API HTTP handlers / Route controllers
│   ├── models/              # Database models / entities
│   ├── services/            # Core business logic
│   └── main.xx              # Application entry point
├── tests/                   # Integration and Unit tests
│   ├── unit/                # Pure function tests (no IO)
│   └── integration/         # Integration tests (DB / API routes)
├── Dockerfile               # Production multi-stage Docker build
├── docker-compose.test.yml  # Local testing environment orchestration
├── README.md                # General onboarding and setup for developers
└── AGENTS.md                # THIS FILE (AI Agent guidance)
```

---

## 4. Key Developer Commands

When executing tasks, use the exact commands listed below. Do not guess or run custom wrappers unless instructed by the user.

- **Start Dev Server (Local)**: `<command to start server with hot reloading, e.g. npm run dev>`
- **Build Application**: `<command to build/compile, e.g. go build -o bin/main cmd/main.go>`
- **Run Unit Tests**: `<command, e.g. npm test or pytest tests/unit>`
- **Run Integration Tests**: `docker compose -f docker-compose.test.yml up --build --exit-code-from app`
- **Lint Code**: `<command, e.g. npm run lint or golangci-lint run>`
- **Format Code**: `<command, e.g. npm run format or go fmt ./...>`

---

## 5. Architectural & Code Style Patterns

- **Coding Standard**: `<e.g., follow standard Go formatting, eslint with prettier, PEP8, etc.>`
- **Error Handling**: `<e.g., return errors explicitly in Go; use try-catch blocks with custom APIError wrappers in Node.js.>`
- **Database Migrations**: `<e.g., describe where migrations are located and how to create/apply them.>`
- **Git Strategy**: Keep commits small, descriptive, and prefix them with conventional tags (e.g. `feat:`, `fix:`, `refactor:`, `docs:`).

---

## 6. Testing & CI/CD Guidelines

- **Unit Testing**: Must mock all database, network, and file system calls.
- **Integration Testing**: Must run against the services declared in `docker-compose.test.yml`. Do not run tests directly against production or live cloud services.
- **CI/CD Compliance**: Every commit to `master` must successfully pass the workflow defined in `.github/workflows/ci.yml` which triggers the `docker-build-push` workflow.
