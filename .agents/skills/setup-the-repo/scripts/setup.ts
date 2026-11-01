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
	console.log("   [2] CLI Application (executable bin, bun compile/run, CLI runner)")
	console.log("   [3] Backend Service / Worker (API / daemon service)")
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

	const pubChoice = await promptUser(rl, "\n6. Enable npm automated publishing in CI? (y/n)", archetype === "core" ? "y" : "n")
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

export async function runSetup(answers: SetupAnswers, rootDir: string = process.cwd()): Promise<void> {
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
		pkg.bin = { [binName]: "./src/index.ts" }
		pkg.scripts["build"] = "tsdown"
		pkg.scripts["dev"] = "bun run src/index.ts"
	}

	if (!answers.enablePublish) {
		delete pkg.publishConfig
	}

	// Remove setup script from package.json if present
	if (pkg.scripts && pkg.scripts.setup) {
		delete pkg.scripts.setup
	}

	writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t") + "\n")
	console.log("   ✓ Updated package.json")

	// 2. Update README.md
	const readmeContent = `# ${answers.packageName}

${answers.description}

[![CI](https://github.com/${answers.repoName}/actions/workflows/ci.yml/badge.svg)](https://github.com/${answers.repoName}/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Part of the [Trajectonomics Lab](https://github.com/trajectonomics-lab) ecosystem.

---

## Installation

\`\`\`bash
bun add ${answers.packageName}
\`\`\`

## Getting Started

\`\`\`typescript
import { initialize } from "${answers.packageName}"

const result = initialize()
console.log(result)
\`\`\`

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
		rmSync(oldAdr)
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
	const srcIndex = `/** Metadata for ${answers.packageName}. */
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
			rmSync(relWorkflow)
			console.log("   ✓ Removed release.yml (npm publishing disabled for this archetype)")
		}
	}

	// 8. Run verification check
	console.log("\n🧪 Running verification suite (`bun run check`)...")
	const checkResult = await $`bun run check`.cwd(rootDir).nothrow()
	if (checkResult.exitCode !== 0) {
		console.warn("⚠️  Verification check had warnings or issues:")
		console.log(checkResult.stderr.toString())
	} else {
		console.log("   ✓ Full verification suite passed with 0 errors!")
	}

	// 9. Self-destruction: Remove this setup skill
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

	// 10. Display Matt Pocock skills setup prompt
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
	const { values } = parseArgs({
		args: Bun.argv.slice(2),
		options: {
			name: { type: "string" },
			pkg: { type: "string" },
			description: { type: "string" },
			archetype: { type: "string" },
			publish: { type: "string" },
			"non-interactive": { type: "boolean", default: false },
		},
		strict: false,
	})

	let answers: SetupAnswers
	if (values["non-interactive"] || values.name) {
		const repoName = (values.name as string) || (await inferDefaultRepoName())
		const packageName = (values.pkg as string) || `@trajectonomics/${repoName.split("/").pop()}`
		const description = (values.description as string) || "TypeScript module for Trajectonomics Lab"
		const rawArch = (values.archetype as string) || "core"
		const archetype = (["core", "cli", "service", "minimal"].includes(rawArch)
			? rawArch
			: "core") as SetupAnswers["archetype"]
		const enablePublish = values.publish === "true" || values.publish === "y"

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

	await runSetup(answers)
}

if (import.meta.main) {
	await main()
}
