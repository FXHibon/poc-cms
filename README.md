# App Template

This is a template repository for creating future applications.

## Features

- **Default Branch**: Configured with `master` as the default branch.
- **Dependency Management**: Integrated with GitHub Dependabot to automatically keep GitHub Actions and other dependency ecosystems up-to-date.
- **IaC Pipeline Integration**: Included a GitHub Action workflow that calls the custom Infrastructure as Code (IaC) action from the [fxhibon/iac](https://github.com/fxhibon/iac) repository.
- **AI Agent Capabilities**: Includes a pre-configured AI Agent Skill under `.gemini/skills/app-setup/` to help AI assistants (like Antigravity) initialize the application codebase, generate custom production-ready Dockerfiles, setup docker-compose.test.yml, and generate documentation.

## Getting Started

1. Use this template to create a new repository on GitHub.
2. If using an AI coding assistant (like Antigravity), instruct it to use the `app-setup` skill under `.gemini/skills/app-setup/` to configure the repository for your specific tech stack.
3. The GitHub Actions workflow will run automatically on pushes and pull requests to the `master` branch.
4. Dependabot will run checkups (weekly) for GitHub Actions.

