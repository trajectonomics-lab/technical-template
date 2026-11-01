# @trajectonomics/technical-template

The official starter repository template for technical packages, libraries, and services across [Trajectonomics Lab](https://github.com/trajectonomics-lab).

## Highlights

- **AI Agent Skills Ready**: Bundled with [Matt Pocock's skills](https://github.com/mattpocock/skills) (`ask-matt`, `tdd`, `implement`, `wayfinder`, `code-review`, etc.) and Trajectonomics [internal skills](https://github.com/trajectonomics-lab/internal-skills) (`pick-the-issue`) managed via `skills-lock.json`. Compatible with Claude Code, Codex, OpenCode, Antigravity CLI, and Pi.
- **Bun First**: Built on [Bun](https://bun.sh) (`1.4.4`) for blazing fast testing, installs, and script execution.
- **Dual ESM + CJS Output**: Powered by [`tsdown`](https://github.com/sxzz/tsdown) with full `.d.ts` and `.d.mts` declaration generation.
- **Strict Verification Pipeline**: Biome linting and formatting (with strict file line ceilings and cognitive complexity limits), strict TypeScript compilation with `isolatedDeclarations`, tests via `bun test`, plus package export verification via [`publint`](https://publint.dev) and [`@arethetypeswrong/cli`](https://github.com/arethetypeswrong/arethetypeswrong).
- **Automated Semver & Releases**: Git-tag-driven version computation (`scripts/version.ts`), automated conventional commit PR title validation, and GitHub Actions publishing workflow.
- **Domain Modeling & ADRs**: Pre-structured `GLOSSARY.md`, Architecture Decision Records (`docs/adr/`), and agent operational guides (`docs/agents/`).

---

## Quick Start

### 1. Create a Repository from this Template

Using GitHub CLI:
```bash
gh repo create trajectonomics-lab/<new-repo-name> \
  --template trajectonomics-lab/technical-template \
  --public \
  --clone
```

Or click **"Use this template"** on GitHub at [trajectonomics-lab/technical-template](https://github.com/trajectonomics-lab/technical-template).

### 2. Install & Verify

```bash
bun install
bun run check
```

---

## New Repository Checklist

After instantiating your repository:

1. **`package.json`**:
   - Update `name`: `@trajectonomics/<package-name>`
   - Update `description`: A concise summary of the module.
   - Update `repository.url`: Point to your new GitHub repository.
2. **Documentation**:
   - Update `README.md` with your project's purpose and usage instructions.
   - Update `GLOSSARY.md` with your domain terms and ubiquitous language.
   - Add your initial Architecture Decision Record under `docs/adr/`.
3. **Agent Configuration**:
   - Verify agent skills: `bun run skills:check`
   - Review [AGENTS.md](./AGENTS.md) and [CODING_STANDARDS.md](./CODING_STANDARDS.md).

---

## Available Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `bun run check` | Lint + Typecheck + Test + Build + Package Lint | Full CI verification pass |
| `bun run test` | `bun test` | Run test suite with Bun test runner |
| `bun run typecheck` | `tsc -p tsconfig.json && tsc -p tsconfig.test.json` | Strict TypeScript typecheck |
| `bun run lint` | `biome ci --error-on-warnings .` | Check formatting and lint rules |
| `bun run format` | `biome check --write .` | Auto-format files and organize imports |
| `bun run build` | `tsdown` | Compile dual ESM/CJS build into `dist/` |
| `bun run lint:package`| `publint --strict && attw --pack . --profile node16` | Validate package exports & types |
| `bun run skills:check`| `bunx skills@latest check` | Verify installed agent skills against lockfile |
| `bun run skills:update`| `bunx skills@latest update` | Update installed skills to latest versions |

---

## Skills Architecture

Skills are pinned in `skills-lock.json`:
- Canonical skill files live in `.agents/skills/`.
- Claude Code symlinks live in `.claude/skills/`.
- Managed using the Vercel `skills` CLI:
  ```bash
  # Check skills status
  bun run skills:check

  # Update pinned skills
  bun run skills:update
  ```

---

## License

[MIT](./LICENSE)
