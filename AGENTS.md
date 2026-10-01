# Repository Agent Guide

This repository uses project-specific GitHub Copilot agents stored in `.github/agents/`.

## Default workflow

1. Use `project-lead` to clarify scope, acceptance criteria, dependencies, and the best specialist.
2. Use `frontend-brand`, `content-seo`, or `lms-backend` for implementation.
3. Use `qa-security` for independent validation.
4. Use `release-manager` only after validation passes.

## Shared constraints

- Follow `.github/copilot-instructions.md` for brand, content, privacy, and engineering rules.
- Keep public content in clear Persian and preserve RTL rendering.
- Never add secrets or real student data to the repository.
- Do not claim work is complete until the relevant checks pass.
- Agents must stay within their assigned scope and report when another specialist is required.

## Available agents

- `project-lead`: plans work and delegates tasks.
- `frontend-brand`: implements the web interface and brand system.
- `content-seo`: maintains Persian content and search metadata.
- `qa-security`: reviews quality, security, privacy, and regressions.
- `release-manager`: prepares verified versions and release notes.
- `lms-backend`: implements the future learning-management backend.
