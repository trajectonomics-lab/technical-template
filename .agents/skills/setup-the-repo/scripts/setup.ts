/**
 * Interactive repository bootstrapper for Trajectonomics Lab templates.
 * Customizes package coordinates, README, GLOSSARY, AGENTS.md, CODING_STANDARDS,
 * workflows, and initial starter code, verifies build with `bun run check`,
 * self-destructs this setup skill, and reminds the user to run /setup-matt-pocock-skills.
 */
import { existsSync, rmSync, writeFileSync, readFileSync } from "node:fs"
import { resolve, join } from "node:path"
import * as readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { parseArgs } from "node:util"
import { $ } from "bun"

interface SetupAnswers {
	repoName: string
	packageName: string
	description: string
	archetype: "core" | "cli" | "service" | "minimal"
	domainTerms: Array<{ term: string; definition: string }>
	enablePublish: boolean
}

async function getRootDir(): Promise<string> {
	try {
		const out = await $`git rev-parse --show-toplevel`.quiet().text()
		if (out.trim()) return out.trim()
	} catch {
		// Fallback to process.cwd()
	}
	return process.cwd()
}

async function getGitRemoteUrl(): Promise<string> {
	try {
		const out = await $`git remote get-url origin`.quiet().text()
		return out.trim()
	} catch {
		return ""
	}
}

async function inferDefaultRepoName(): Promise<string> {
	const remote = await getGitRemoteUrl()
	if (remote) {
		const match = remote.match(/[:/]([^/:]+\/[^/:]+?)(?:\.git)?$/)
		if (match && match[1]) {
			const candidate = match[1].replace(/\.git$/, "")
			if (!candidate.endsWith("technical-template")) {
				return candidate
			}
		}
	}
	const cwd = process.cwd()
	const dirName = cwd.split("/").pop() || "my-repo"
	return `trajectonomics-lab/${dirName}`
}

async function promptUser(rl: readline.Interface, question: string, defaultVal: string): Promise<string> {
	const answer = await rl.question(`${question} [${defaultVal}]: `)
	return answer.trim() || defaultVal
}

async function collectAnswersInteractive(): Promise<SetupAnswers> {
	const rl = readline.createInterface({ input, output })

	console.log("\n🚀 Welcome to Trajectonomics Lab Repository Setup!")
	console.log("This wizard will customize your repository and set up all tools.\n")

	const defaultRepo = await inferDefaultRepoName()
	const repoName = await promptUser(rl, "1. GitHub Repository Name (org/repo)", defaultRepo)

	const defaultPkgName = `@trajectonomics/${repoName.split("/").pop() || "project"}`
	const packageName = await promptUser(rl, "2. Package Name (for package.json)", defaultPkgName)

	const description = await promptUser(
		rl,
		"3. Short Description",
		"High-performance TypeScript component for Trajectonomics Lab",
	)

	console.log("\n4. Select Project Archetype:")
	console.log("   [1] Pure Domain Library (deterministic, no I/O, strict types, tsdown dual ESM/CJS)")
	console.log("   [2] CLI Application (executable bin, tsdown build, CLI entrypoint)")
	console.log("   [3] Backend Service / Worker (API daemon, private package)")
	console.log("   [4] Minimal TypeScript Library")
	const archetypeChoice = await promptUser(rl, "   Choose archetype (1-4)", "1")

	let archetype: SetupAnswers["archetype"] = "core"
	if (archetypeChoice === "2") archetype = "cli"
	else if (archetypeChoice === "3") archetype = "service"
	else if (archetypeChoice === "4") archetype = "minimal"

	console.log("\n5. Initial Domain Glossary Terms (for GLOSSARY.md)")
	const term1 = await promptUser(rl, "   First key domain term", "Entity")
	const def1 = await promptUser(rl, `   Definition for '${term1}'`, "Primary domain model with identity.")

	const term2 = await promptUser(rl, "   Second key domain term (or press enter to skip)", "")
	const def2 = term2 ? await promptUser(rl, `   Definition for '${term2}'`, "") : ""

	const domainTerms: Array<{ term: string; definition: string }> = [{ term: term1, definition: def1 }]
	if (term2 && def2) domainTerms.push({ term: term2, definition: def2 })

	const defaultPublish = archetype === "core" ? "y" : "n"
	const pubChoice = await promptUser(rl, `\n6. Enable npm automated publishing in CI? (y/n)`, defaultPublish)
	const enablePublish = pubChoice.toLowerCase().startsWith("y")

	rl.close()

	return {
		repoName,
		packageName,
		description,
		archetype,
		domainTerms,
		enablePublish,
	}
}

export async function runSetup(answers: SetupAnswers, rootDir: string): Promise<void> {
	console.log("\n⚙️  Applying project customizations...")

	// 1. Update package.json
	const pkgPath = join(rootDir, "package.json")
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
	pkg.name = answers.packageName
	pkg.description = answers.description
	pkg.repository = {
		type: "git",
		url: `git+https://github.com/${answers.repoName}.git`,
	}

	if (answers.archetype === "cli") {
		const binName = answers.packageName.split("/").pop() || "cli"
		pkg.bin = { [binName]: "./dist/index.cjs" }
		pkg.scripts.build = "tsdown"
		pkg.scripts.dev = "bun run src/index.ts"
	}

	if (answers.archetype === "service") {
		pkg.private = true
	}

	if (!answers.enablePublish) {
		delete pkg.publishConfig
		if (answers.archetype !== "core") {
			pkg.private = true
		}
	}

	// Remove setup script from package.json if present
	if (pkg.scripts && pkg.scripts.setup) {
		delete pkg.scripts.setup
	}

	writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t") + "\n")
	console.log("   ✓ Updated package.json")

	// 2. Update README.md
	const isCli = answers.archetype === "cli"
	const isService = answers.archetype === "service"

	const installSection = isService
		? `## Installation & Deployment\n\n\`\`\`bash\nbun install\nbun run build\n\`\`\``
		: isCli
			? `## Installation\n\n\`\`\`bash\nbun add -g ${answers.packageName}\n# Or run directly via bunx:\nbunx ${answers.packageName}\n\`\`\``
			: `## Installation\n\n\`\`\`bash\nbun add ${answers.packageName}\n\`\`\``

	const usageSection = isCli
		? `## CLI Usage\n\n\`\`\`bash\n${answers.packageName.split("/").pop()} --help\n\`\`\``
		: `## Getting Started\n\n\`\`\`typescript\nimport { initialize } from "${answers.packageName}"\n\nconst result = initialize()\nconsole.log(result)\n\`\`\``

	const readmeContent = `# ${answers.packageName}

${answers.description}

[![CI](https://github.com/${answers.repoName}/actions/workflows/ci.yml/badge.svg)](https://github.com/${answers.repoName}/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Part of the [Trajectonomics Lab](https://github.com/trajectonomics-lab) ecosystem.

---

${installSection}

${usageSection}

---

## Development

\`\`\`bash
# Install dependencies
bun install

# Run full verification suite (lint, typecheck, tests, build)
bun run check

# Run tests
bun test

# Code formatting & lint
bun run format
bun run lint
\`\`\`

---

## Domain Documentation

- [GLOSSARY.md](./GLOSSARY.md): Ubiquitous domain terminology.
- [AGENTS.md](./AGENTS.md): Guidelines and rules for autonomous AI coding agents.
- [CODING_STANDARDS.md](./CODING_STANDARDS.md): Architecture, purity, and review invariants.
- [docs/adr/](./docs/adr/): Architecture Decision Records.

---

## License

[MIT](./LICENSE)
`
	writeFileSync(join(rootDir, "README.md"), readmeContent)
	console.log("   ✓ Generated README.md")

	// 3. Update GLOSSARY.md
	let glossaryContent = `# Domain Glossary: ${answers.packageName}

Ubiquitous language for \`${answers.repoName}\`. Every term defined here is binding across code, tests, documentation, and PR titles. Synonyms in a diff are defects.

## Core Terms

`
	for (const { term, definition } of answers.domainTerms) {
		glossaryContent += `### ${term}\n${definition}\n\n`
	}
	glossaryContent += `### Invariant
A rule or condition that must hold true across all state transitions in this system.
`
	writeFileSync(join(rootDir, "GLOSSARY.md"), glossaryContent)
	console.log("   ✓ Generated GLOSSARY.md")

	// 4. Update AGENTS.md
	const agentsPath = join(rootDir, "AGENTS.md")
	if (existsSync(agentsPath)) {
		let agentsContent = readFileSync(agentsPath, "utf-8")
		agentsContent = agentsContent.replace(
			/Instructions for AI coding agents working in `[^`]*` repositories instantiated from this template\./,
			`Instructions for AI coding agents in \`${answers.repoName}\` (\`${answers.packageName}\`).`,
		)
		agentsContent = agentsContent.replace(
			/## Checklist When Instantiating a New Repo[\s\S]*$/,
			`## Repository Information\n\n- Repository: https://github.com/${answers.repoName}\n- Package: \`${answers.packageName}\`\n`,
		)
		writeFileSync(agentsPath, agentsContent)
		console.log("   ✓ Updated AGENTS.md")
	}

	// 5. Update docs/adr/0001-...
	const adrPath = join(rootDir, "docs/adr/0001-core-architecture-decisions.md")
	const oldAdr = join(rootDir, "docs/adr/0001-template-architecture-decisions.md")
	if (existsSync(oldAdr)) {
		rmSync(oldAdr, { force: true })
	}
	const adrContent = `# ADR 0001: Architecture Foundations for ${answers.packageName}

## Status

Accepted

## Context

\`${answers.repoName}\` is established to provide ${answers.description}.
It is built with Bun, TypeScript, and Biome under the Trajectonomics Lab architectural guidelines.

## Decision

1. **Archetype**: Configured as \`${answers.archetype}\`.
2. **Language & Runtime**: TypeScript (strict mode with \`isolatedDeclarations\`) executed on Bun.
3. **Domain Integrity**: All domain concepts adhere to [GLOSSARY.md](../../GLOSSARY.md).
4. **Agent Collaboration**: AI agents adhere to [AGENTS.md](../../AGENTS.md) and [CODING_STANDARDS.md](../../CODING_STANDARDS.md).

## Consequences

- Invariants remain verifiable through deterministic tests (\`bun test\`) and \`bun run check\`.
- All autonomous agent work is test-first and reviewed against established coding standards.
`
	writeFileSync(adrPath, adrContent)
	console.log("   ✓ Recorded ADR 0001")

	// 6. Update src/index.ts and src/index.test.ts
	const srcIndex = isCli
		? `#!/usr/bin/env node
/** CLI entrypoint for ${answers.packageName}. */
export interface InitializationResult {
	readonly name: string
	readonly initialized: boolean
	readonly timestamp: number
}

export function initialize(timestamp: number = 0): InitializationResult {
	return Object.freeze({
		name: "${answers.packageName}",
		initialized: true,
		timestamp,
	})
}

if (import.meta.main) {
	const res = initialize(Date.now())
	console.log(\`\${res.name} initialized at \${res.timestamp}\`)
}
`
		: `/** Metadata for ${answers.packageName}. */
export interface InitializationResult {
	readonly name: string
	readonly initialized: boolean
	readonly timestamp: number
}

/**
 * Initializes ${answers.packageName}.
 */
export function initialize(timestamp: number = 0): InitializationResult {
	return Object.freeze({
		name: "${answers.packageName}",
		initialized: true,
		timestamp,
	})
}
`
	const srcTest = `import { describe, expect, it } from "bun:test"
import { initialize } from "./index"

describe("initialize", () => {
	it("returns operational metadata for ${answers.packageName}", () => {
		const res = initialize(12345)
		expect(res.name).toBe("${answers.packageName}")
		expect(res.initialized).toBe(true)
		expect(res.timestamp).toBe(12345)
	})

	it("returns a frozen object", () => {
		const res = initialize()
		expect(Object.isFrozen(res)).toBe(true)
	})
})
`
	writeFileSync(join(rootDir, "src/index.ts"), srcIndex)
	writeFileSync(join(rootDir, "src/index.test.ts"), srcTest)
	console.log("   ✓ Generated starter code and test in src/")

	// 7. Adjust Release CI if publishing is disabled
	if (!answers.enablePublish) {
		const relWorkflow = join(rootDir, ".github/workflows/release.yml")
		if (existsSync(relWorkflow)) {
			rmSync(relWorkflow, { force: true })
			console.log("   ✓ Removed release.yml (npm publishing disabled for this archetype)")
		}
	}

	// 8. Ensure dependencies are installed
	if (!existsSync(join(rootDir, "node_modules"))) {
		console.log("\n📦 Installing dependencies (`bun install`)...")
		await $`bun install`.cwd(rootDir)
	}

	// 9. Run verification check
	console.log("\n🧪 Running verification suite (`bun run check`)...")
	const checkResult = await $`bun run check`.cwd(rootDir).nothrow()
	if (checkResult.exitCode !== 0) {
		console.error("\n❌ Verification check failed!")
		console.error(checkResult.stdout.toString())
		console.error(checkResult.stderr.toString())
		console.error("\n⚠️  Self-destruction ABORTED so you can inspect and fix errors.")
		console.error("   Once resolved, re-run `bun run setup` or `bun run check`.")
		process.exit(1)
	}
	console.log("   ✓ Full verification suite passed with 0 errors!")

	// 10. Self-destruction: Remove this setup skill
	console.log("\n🧹 Cleaning up: Removing setup-the-repo bootstrap skill...")
	const skillDir = join(rootDir, ".agents/skills/setup-the-repo")
	const claudeSymlink = join(rootDir, ".claude/skills/setup-the-repo")

	if (existsSync(claudeSymlink)) {
		rmSync(claudeSymlink, { force: true })
		console.log("   ✓ Removed .claude/skills/setup-the-repo symlink")
	}
	if (existsSync(skillDir)) {
		rmSync(skillDir, { recursive: true, force: true })
		console.log("   ✓ Removed .agents/skills/setup-the-repo directory")
	}

	// 11. Optionally create a git commit if inside a git repository
	try {
		await $`git -C ${rootDir} add .`.quiet()
		await $`git -C ${rootDir} commit -m "chore: bootstrap project from template and remove setup-the-repo skill"`.quiet()
		console.log("   ✓ Created bootstrap commit in git")
	} catch {
		// Not in git or no changes to commit
	}

	// 12. Display Matt Pocock skills setup prompt
	console.log("\n" + "=".repeat(78))
	console.log("🎉 REPOSITORY SETUP COMPLETE!")
	console.log("=".repeat(78))
	console.log(`
Your repository '${answers.repoName}' (${answers.packageName}) is now fully
configured, built, and verified.

The single-use bootstrap skill 'setup-the-repo' has removed itself.

👉 IMPORTANT NEXT STEP:
   Set up Matt Pocock's skills and issue tracker workflow for this repo:

   Run the skill:
   /setup-matt-pocock-skills

   This will:
   1. Connect your issue tracker (GitHub Issues with the \`gh\` CLI).
   2. Configure canonical triage labels (needs-triage, ready-for-agent, etc.).
   3. Establish domain document rules for autonomous agents.

After that, you're ready to pick or create your first issue with /to-tickets
or /pick-the-issue!
`)
	console.log("=".repeat(78) + "\n")
}

async function main(): Promise<void> {
	const rootDir = await getRootDir()
	const remoteUrl = await getGitRemoteUrl()

	const { values } = parseArgs({
		args: Bun.argv.slice(2),
		options: {
			name: { type: "string" },
			pkg: { type: "string" },
			description: { type: "string" },
			archetype: { type: "string" },
			publish: { type: "string" },
			force: { type: "boolean", default: false },
			"non-interactive": { type: "boolean", default: false },
		},
		strict: false,
	})

	// Guard against running accidentally inside the template repository itself
	if (remoteUrl.includes("trajectonomics-lab/technical-template") && !values.force) {
		console.error("🛑 Refusing to run bootstrap setup on the template source repository itself!")
		console.error("   To test setup, clone or instantiate a new repository from this template.")
		console.error("   (Or pass --force if you specifically intend to overwrite the template repository.)")
		process.exit(1)
	}

	const isInteractive = !values["non-interactive"] && process.stdin.isTTY

	let answers: SetupAnswers
	if (!isInteractive || values.name) {
		const repoName = (values.name as string) || (await inferDefaultRepoName())
		const packageName = (values.pkg as string) || `@trajectonomics/${repoName.split("/").pop()}`
		const description = (values.description as string) || "TypeScript module for Trajectonomics Lab"
		const rawArch = (values.archetype as string) || "core"
		const archetype = (["core", "cli", "service", "minimal"].includes(rawArch)
			? rawArch
			: "core") as SetupAnswers["archetype"]
		const enablePublish = values.publish
			? values.publish === "true" || values.publish === "y"
			: archetype === "core"

		answers = {
			repoName,
			packageName,
			description,
			archetype,
			domainTerms: [{ term: "Entity", definition: "Core domain model with unique identity." }],
			enablePublish,
		}
	} else {
		answers = await collectAnswersInteractive()
	}

	await runSetup(answers, rootDir)
}

if (import.meta.main) {
	await main()
}
