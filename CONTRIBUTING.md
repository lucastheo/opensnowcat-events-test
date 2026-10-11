# Contributing Guidelines

Simple guide for commits, branching, and pull requests in this repository.

---

## 1. Commit Message Pattern

Follow the lightweight Conventional Commits format:

```text
<type>(<scope>): <short description>
```

### Types
- `feat`: New feature or functionality
- `fix`: Bug fix
- `test`: Adding or modifying tests
- `refactor`: Code changes without functional or bug changes
- `docs`: Documentation updates
- `chore`: Tooling, configuration, or dependency updates

### Scopes
Map scopes directly to the project modules:
- `frontend` (`apps/frontend-producer`)
- `backend` (`apps/backend-producer`)
- `collector` (`apps/simple-collector`)
- `test-bot` (`apps/test-bot`)
- `docker` (Dockerfiles or compose orchestration)
- `docs`

### Examples
- `feat(collector): implement FIFO promise queue for csv writes`
- `fix(backend): correct timestamp format on dual emission payload`
- `test(frontend): add unit tests for event dispatcher`
- `docs: update setup instructions in README`

---

## 2. Branch Naming Pattern

Use standard prefixed branch names:

```text
<type>/<scope>-<short-description>
```

### Examples
- `feat/collector-csv-queue`
- `fix/backend-route-validation`
- `test/test-bot-page-actions`
- `docs/add-contributing-guide`

---

## 3. Pull Request Guidelines

1. **Title:** Match the commit convention: `<type>(<scope>): <short description>`.
2. **Description:**
   - **Summary:** 1–3 sentences describing what changed and why.
   - **Affected Modules:** List which apps under `apps/` or `docs/` were modified.
   - **Checklist:**
     - [ ] Follows architectural standards (Node.js 26 ESM, 3-tier backend layering, etc.).
     - [ ] Includes 1:1 unit tests for new or modified source files.
     - [ ] Tests and builds pass locally.
     - [ ] Code passes type-checking and linting without errors (`npm run type-check`).

---

## 4. Linting & Static Analysis

All applications enforce strict static analysis and type linting before committing code or opening pull requests. Type-checking acts as our primary static linting gate to prevent runtime bugs, broken imports, and typing regressions.

### Running Static Analysis

Run `npm run type-check` inside each respective application directory:

- **Backend Producer (`apps/backend-producer`):**
  ```bash
  cd apps/backend-producer
  npm run type-check
  ```

- **Simple Collector (`apps/simple-collector`):**
  ```bash
  cd apps/simple-collector
  npm run type-check
  ```

### What It Validates

The static analysis script executes `tsc --noEmit`, which performs full compiler validation without emitting build artifacts:
- **Strict TypeScript Typing:** Validates strict null checks, disallows implicit `any`, and enforces exact return types and argument types.
- **Syntax & Module Integrity:** Validates ESM syntax and import resolutions across Node.js 26 native modules and path aliases (e.g., `@/*` in `apps/backend-producer`).
- **Unused Symbols:** Catches unused local variables and parameters according to each project's `tsconfig.json`.
- **Interface & Schema Contracts:** Ensures request/response DTOs and domain models remain strictly synchronized.

