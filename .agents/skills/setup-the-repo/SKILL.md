---
name: setup-the-repo
description: "Interactive questionnaire and automated bootstrapper to customize a new repository created from trajectonomics/technical-template. Sets up package metadata, README, CI workflows, GLOSSARY, AGENTS rules, and starter code, self-destructs the setup skill, and instructs setting up Matt Pocock's skills. For packages that publish to npm, also writes a first-publish and trusted-publishing checklist."
disable-model-invocation: true
---

# Setup The Repo

Interactive repository bootstrapper and customizer for new repositories created from `trajectonomics/technical-template`.

This is a **single-use bootstrap skill**: it conducts an interactive interview to discover what you really need for the new project, customizes all files, proves the build and tests pass, **self-destructs (removes this setup skill completely)**, and instructs you to run `/setup-matt-pocock-skills` to complete the engineering agent setup.

---

## How to Run

### Option 1: Automated Script Execution (Fastest)

Run the included TypeScript wizard with Bun:

```bash
# Interactive wizard in your terminal:
bun run setup

# Or directly:
bun .agents/skills/setup-the-repo/scripts/setup.ts

# Non-interactive / scripted with flags:
bun .agents/skills/setup-the-repo/scripts/setup.ts \
  --name "trajectonomics/my-project" \
  --pkg "@trajectonomics/my-project" \
  --description "Deterministic projection engine" \
  --archetype core \
  --publish true
```

---

### Option 2: Interactive Agent Protocol

If driven through an AI coding assistant session, the agent carries out this interactive protocol:

#### 1. Explore Current Context
- Inspect `git remote get-url origin` to infer the GitHub repository name (`trajectonomics/<repo>`).
- Inspect current folder name.
- Read existing `package.json`.

#### 2. Interactive Questionnaire
Ask the user the following questions concisely (with smart defaults pre-filled):

1. **Repository Identity**:
   - GitHub Repository (`trajectonomics/<name>`)
   - Package Name (`@trajectonomics/<name>`)
   - One-line Description

2. **Project Archetype (What do you really need?)**:
   - `[1] Pure Domain Library` (deterministic, zero I/O, strict types, dual ESM/CJS build with `tsdown`, npm provenance publishing, `publint` + `attw`).
   - `[2] CLI Tool` (executable bin script with Bun/Node, command entry point, local/binary build).
   - `[3] Backend Service / Worker` (API service, Cloudflare Worker, or daemon).
   - `[4] Minimal Library` (clean starter keeping Bun, Biome, and Bun Test).

3. **Domain Vocabulary**:
   - 1-3 core ubiquitous terms and definitions to seed `GLOSSARY.md`.

4. **CI & Release Workflow**:
   - Enable automated npm releases on main push? (Default: `yes` for Pure Domain Library, `no` for CLI/Service).
   - If yes, this repo publishes a package: the **Publish Setup** step (below) applies. Ask which npm
     account will do the first publish and whether the package name is already taken.

#### 3. Present Plan & Confirm
Show the user a concise summary of what will be configured:
- Target package name and repository
- Archetype selected
- Files to be customized (`package.json`, `README.md`, `GLOSSARY.md`, `AGENTS.md`, `CODING_STANDARDS.md`, `docs/adr/0001-...md`, `src/index.ts`, `src/index.test.ts`, `.github/workflows/`)

#### 4. Apply Customizations
- Update `package.json` with the new package name, description, git remote, and adjusted scripts/bin.
- Generate project-specific `README.md` with badge links, installation guide, and scripts.
- Seed `GLOSSARY.md` with the user's domain terms.
- Update `AGENTS.md` and `CLAUDE.md` to reference the new package and repository.
- Record initial Architecture Decision Record under `docs/adr/0001-core-architecture-decisions.md`.
- Scaffold typed starter functions and passing unit tests in `src/index.ts` and `src/index.test.ts`.
- Adjust `.github/workflows/` (remove `release.yml` if npm publishing is disabled).
- If publishing is enabled, write `docs/publishing.md` (the first-publish and trusted-publishing checklist) and link it from `README.md`. The skill deletes itself, so the repo must keep this guide.
- Remove `"setup"` script entry from `package.json`.

#### 5. Verify Build and Quality Gates
Run:
```bash
bun install
bun run check
```
Verify that Biome (0 warnings), TypeScript (strict typecheck), tests (`bun test`), build (`tsdown`), and package lint (`publint` + `attw`) pass 100% green.

#### 6. Self-Destruction / Skill Cleanup
Because this is a bootstrap-only skill, remove it so the repository remains clean:
- Delete `.agents/skills/setup-the-repo/`
- Delete `.claude/skills/setup-the-repo` symlink
- Commit the bootstrap changes:
  ```bash
  git add .
  git commit -m "chore: bootstrap project from template and remove setup-the-repo skill"
  ```

#### 7. Publish Setup (only when the repo publishes a package)
Skip this step when npm publishing is disabled. Otherwise walk the user through `docs/publishing.md`:
1. **npm sign-in**: check `npm whoami`. If signed out, run `BROWSER=none npm login --auth-type=web` in the background and give the user the printed URL immediately; it expires in about five minutes. Never ask for a password, token, or one-time code in chat.
2. **Scope and name**: confirm the user belongs to the package's npm org (`npm org ls <org> <user>`) and that `npm view <package>` returns 404 (name is free).
3. **First publish, locally**: npm cannot attach a trusted publisher to a package that does not exist, so the maintainer publishes the first alpha by hand (the one exception to "never publish locally"). Bump the version in the working tree only, `npm publish --access public --tag alpha --provenance=false`, have the user approve the 2FA URL, then `git checkout package.json`. No `NPM_TOKEN` is needed.
4. **Trusted publishing**: on npmjs.com, package Settings, Trusted Publisher, GitHub Actions, repository `<org>/<repo>`, workflow `release.yml`, **allow publish directly**, no environment name. One successful CI publish must validate it within two days. Then disallow tokens for publishing.
5. **Check `release.yml`**: it should be the thin caller of `trajectonomics/cicd/.github/workflows/publish.yml@v1` with `id-token: write` (npm validates the calling file). A copy with the "Skipping publish step" guard exits green without publishing once no `NPM_TOKEN` exists. After the first merge confirm with `npm view <package> dist-tags`. Stable releases are GitHub Releases with a `vX.Y.Z` tag on `main`.

Only the user can do steps 1, 3 and 4 (credentials, the 2FA approval, and npmjs.com settings). The agent runs the read-only checks and verifies the result.

#### 8. Prompt to Setup Matt Pocock's Skills
Output the following prominent call-to-action to the user:

```markdown
================================================================================
🎉 REPOSITORY SETUP COMPLETE!
================================================================================

Your repository has been customized, built, and verified.
The single-use bootstrap skill `setup-the-repo` has been removed.

👉 IMPORTANT NEXT STEP:
   Run `/setup-matt-pocock-skills` to configure Matt Pocock's engineering skills:

   This sets up:
   1. Issue tracker (GitHub Issues with `gh` CLI).
   2. Canonical triage labels (`needs-triage`, `ready-for-agent`, `needs-info`, etc.).
   3. Domain document consumption rules (`GLOSSARY.md` and `docs/adr/`).

If the repo publishes a package, also print:

```markdown
📦 PUBLISH SETUP: the package is not on npm until you finish docs/publishing.md
   (npm sign-in, first local publish, then trusted publishing).
```

After running `/setup-matt-pocock-skills`, you can pick or create your first ticket
using `/pick-the-issue` or `/to-tickets`!
================================================================================
```
