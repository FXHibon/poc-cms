# NovaCMS (WordPress/Joomla POC)

NovaCMS is a simple, highly-polished proof-of-concept Content Management System (CMS) built to demonstrate server-side rendering (SSR) and dynamic client personalization using a lightweight Node.js stack.

## Features

- **Public UI**: A server-side rendered (SSR) web site featuring a sleek glassmorphic dark theme and dynamic accent color synchronization matching database configurations (ideal for SEO and high LCP performance).
- **Administrator Panel**: A Single Page Application (SPA) dashboard containing real-time statistics widgets, searchable pages data tables, dialog modals, automated slug sync, custom color pickers, and password management tools.
- **Security**: Secure cookie-based JWT authentication, password hashing using bcrypt, and non-root Docker configurations.
- **Testing**: Complete local integration test suite running on native Node.js and isolated testing databases.

---

## Prerequisites

To run this application locally, you will need:
- **Node.js** v20.0.0 or higher
- **NPM** v10.0.0 or higher
- **Docker** and **Docker Compose** (recommended)
- **PostgreSQL** (if running natively without Docker)

---

## Getting Started

### Method 1: Using Docker Compose (Recommended)

1. Build and start the containers:
   ```bash
   docker compose up --build
   ```
2. The database schema will initialize automatically. Once the console logs `NovaCMS backend running on port 3000`, open the application in your browser:
   - **Public Site**: `http://localhost:3000`
   - **Administrator Panel**: `http://localhost:3000/admin`
3. Log in with the default seeded administrator credentials:
   - **Username**: `admin`
   - **Password**: `admin`

### Method 2: Running Natively

1. Install project dependencies:
   ```bash
   npm install
   ```
2. Set up your local PostgreSQL database, then create a `.env` file at the root of the project with the following configuration:
   ```env
   PORT=3000
   DATABASE_URL=postgresql://your_user:your_password@localhost:5432/your_database_name
   JWT_SECRET=your_custom_development_secret_key
   ```
3. Initialize the database schema and seed default settings:
   ```bash
   npm run init-db
   ```
4. Start the development server (runs with nodemon hot-reloads):
   ```bash
   npm run dev
   ```

---

## Testing

### Automated Integration Tests

To run the integration tests in a clean, containerized database environment:
```bash
docker compose -f docker-compose.test.yml up --build --exit-code-from app
```

To run tests locally on your host environment (requires a running PostgreSQL instance pointing to your test config):
```bash
npm test
```

---

## CI/CD Pipeline

 NovaCMS includes automated CI workflows located in [.github/workflows/ci.yml](file:///.github/workflows/ci.yml).
Whenever a push or pull request is made to the `master` branch:
1. The GitHub runner triggers the build workflow.
2. It compiles the multi-stage production `Dockerfile`.
3. It runs automated testing checks and pushes verified releases to Docker Hub.
