---
name: app-setup
description: |
  Initialize and configure a project codebase created from the app-template.
  Use this skill to configure the application's production Dockerfile, local docker-compose testing environment, README.md, AGENTS.md developer guide, and repository secrets.

  Trigger immediately when:
  - The repository has just been created from the template and contains no application code yet.
  - The user requests to initialize a new application or service (e.g. Node.js, Go, Python, React) within the repository.
  - The Dockerfile or docker-compose.test.yml configuration needs to be created or aligned with the project's tech stack.
  - The developer wants to create or update the AGENTS.md instructions for subsequent agent tasks.

  DO NOT trigger for:
  - Generic code edits or bug-fixing tasks that do not involve configuring/re-architecting build and deployment pipelines.
  - Modifying existing production files where build/CI/CD configurations are already fully configured.
---

# App Setup Skill

This skill guides the agent through initializing a new application in a repository cloned/instantiated from the `app-template`. It ensures the repository has a production-ready Dockerfile, a local test environment via Docker Compose, a revised README.md, an AGENTS.md file to onboard future agent sessions, and configured repository secrets.

## When to Use

Use this skill whenever you need to kickstart a repository template into a specific application stack, or when you need to audit and align the build, run, test, and documentation processes with modern best practices.

---

## Step-by-Step Instructions

### Step 1. Align on the Tech Stack

Before creating any files, analyze the repository to see if a tech stack is already partially implemented (e.g., presence of `package.json`, `go.mod`, `requirements.txt`, `Cargo.toml`).
- If no files are present, ask the user to clarify the desired programming language, framework, database, and caching layers.
- Once the tech stack is identified, write a custom Dockerfile conforming to the standards below.

---

### Step 2. Create a Production-Ready Dockerfile

Generate a `Dockerfile` at the root of the repository. It must adhere to the following security and performance practices:

#### 1. Multi-Stage Builds
Always separate the build stage from the execution stage to minimize the size of the final image and reduce the attack surface (eliminating build tools, compilers, and secrets).
- **Build Stage**: Installs development dependencies and builds the application.
- **Run Stage**: Uses a minimal, secure base image (e.g., Alpine or Distroless) and only copies the compiled binaries or production assets.

#### 2. Leverage Docker Cache
Order instructions to prevent invalidating the build cache unnecessarily:
- Copy lockfiles and dependency definitions first (e.g., `package.json` + `package-lock.json`, `go.mod` + `go.sum`, `requirements.txt`).
- Install dependencies.
- Copy the remaining source files and compile/build the app.

#### 3. Security Hardening
- **Run as Non-Root**: Never run the container process as `root`. Use existing system users (e.g., `USER node` in Node.js images) or create a dedicated application user:
  ```dockerfile
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  USER appuser
  ```
- **Read-Only / Ephemeral Filesystem**: Assume the container's root filesystem is read-only. Write temp files only to `/tmp`.
- **Pin Base Image Versions**: Do not use generic tags like `:latest` or `:alpine`. Always specify a major/minor version (e.g., `node:20.11-alpine` or `golang:1.22-alpine3.19`).

---

### Step 3. Set Up Local Testing with Docker Compose

If the application depends on external services (databases, caches, message brokers), create a `docker-compose.test.yml` at the root of the repository.

#### Requirements for docker-compose.test.yml:
- **Application Service**: Define the application container, building from the local `Dockerfile`.
- **Database/Service Containers**: Pin specific database versions (e.g., `postgres:15-alpine`, `redis:7-alpine`).
- **Environment Variables**: Configure test-specific secrets and configs (e.g., `POSTGRES_DB=test_db`, `DATABASE_URL=postgres://user:pass@db:5432/test_db`).
- **Startup Order**: Use `depends_on` with `condition: service_healthy` to ensure database services are running and ready before launching the application tests:
  ```yaml
  db:
    image: postgres:15-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
  ```
- **Volume Isolation**: Use named volumes for local database storage, but ensure they are ignored in `.gitignore` to avoid committing DB data.

---

### Step 4. Initialize AGENTS.md

AI agents need context on how to work with the codebase. Create an `AGENTS.md` file at the root of the repository containing:
- **Project Overview**: A 2-3 sentence context about what the application does.
- **Technology Stack**: Detailed specifications of languages, runtimes, database drivers, and frameworks.
- **Directory Structure Map**: A text-based tree outlining where code, assets, configuration, and scripts live.
- **Developer Commands**: Exact commands for starting the dev server, running unit tests, executing database migrations, and running the linter.
- **Architecture Guidelines**: Coding patterns, clean architecture choices, where to add new endpoints, and migration rules.

*Refer to `resources/AGENTS.template.md` inside this skill directory for a boilerplate structure.*

---

### Step 5. Rewrite README.md

Replace the default repository `README.md` with one customized for the specific application. The new README must include:
- **Title and Description**: A clear overview of the application.
- **Prerequisites**: Minimum software requirements (Node version, Go version, Docker, Docker Compose, etc.).
- **Getting Started (Local Development)**: Step-by-step instructions on running the application locally with hot reloading (e.g., using `docker compose up` or local commands).
- **Testing**: How to run unit and integration tests (including how to run tests locally via `docker-compose.test.yml`).
- **Docker Production Build & Run**: Commands to build the production image locally and test it.
- **CI/CD Integration**: A section detailing the GitHub Action workflow (`ci.yml`) and how it builds/pushes images using the `FXHibon/iac` setup.

---

### Step 6. Automatically Configure Repository Secrets (CI/CD Setup)

When launching the repository from the template, repository-level secrets are not copied over automatically. You must configure them in the new repository to ensure the CI/CD pipeline (`ci.yml`) executes successfully.

To do this automatically:
1. Ensure the `DOCKERHUB_TOKEN` environment variable is defined in your environment.
2. Execute the helper script [configure_secrets.sh](./gemini/skills/app-setup/scripts/configure_secrets.sh) located in this skill:
   ```bash
   ./.gemini/skills/app-setup/scripts/configure_secrets.sh
   ```

This script will automatically configure both the **GitHub Actions secrets** and **Dependabot secrets** for the repository using `fxhibon` as the Docker Hub username and the value of your local `$DOCKERHUB_TOKEN` environment variable.

If the `DOCKERHUB_TOKEN` variable is missing or the CLI commands fail (e.g., because of auth or CLI missing issues), warn the user and instruct them to set the secrets manually under:
- **Actions Secrets**: `Settings > Secrets and variables > Actions > New repository secret`
- **Dependabot Secrets**: `Settings > Secrets and variables > Dependabot > New repository secret`

---

### Step 7. Configure Repository Settings (Projects, Wiki, and Branch Protection)

After creating the repository, configure its options and enable branch protection on the `master` branch.

To do this automatically:
1. Execute the helper script [configure_repo.sh](./gemini/skills/app-setup/scripts/configure_repo.sh) located in this skill:
   ```bash
   ./.gemini/skills/app-setup/scripts/configure_repo.sh
   ```

This script will use the `gh` CLI to:
- Disable GitHub Projects
- Disable GitHub Wiki
- Enable a classic branch protection rule on the `master` branch:
  - Require a pull request before merging (with `0` required approvals)
  - Require status checks to pass, explicitly requiring the `docker-build / Build & Push Docker Image` status check
  - Require branches to be up to date before merging (`strict: true`)

If the CLI commands fail (e.g., due to permissions or missing CLI authentication), instruct the user to configure these settings manually under **Settings**:
- **General**: Uncheck **Wikis** and **Projects** under the "Features" section.
- **Branches**: Add a branch protection rule for `master` with:
  - **Require a pull request before merging** enabled (with required approvals set to 0 or disabled).
  - **Require status checks to pass before merging** enabled:
    - **Require branches to be up to date before merging** checked.
    - Status check search: add **docker-build / Build & Push Docker Image**.

---

## Skill Templates & Resources

Use the template assets located in the `resources` directory of this skill:
- **AGENTS.md Template**: [AGENTS.template.md](file:///Users/hibonfrancoisxavier/fxhibon/app-template/.gemini/skills/app-setup/resources/AGENTS.template.md)
- **Docker Compose Template**: [docker-compose.test.template.yml](file:///Users/hibonfrancoisxavier/fxhibon/app-template/.gemini/skills/app-setup/resources/docker-compose.test.template.yml)
