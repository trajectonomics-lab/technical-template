/**
 * Publish-setup guidance for packages created from the template.
 * The checklist is written into the new repo (docs/publishing.md) because the
 * setup skill deletes itself; the status check is read-only.
 */
import { $ } from "bun"

function scopeOf(packageName: string): string | null {
	return packageName.startsWith("@") ? (packageName.split("/")[0] ?? null) : null
}

/** Markdown checklist for the first npm publish and the switch to trusted publishing. */
export function publishChecklist(packageName: string, repoName: string): string {
	const scope = scopeOf(packageName)
	const scopeStep = scope
		? `Confirm you belong to the \`${scope}\` npm org: \`npm org ls ${scope.slice(1)} <your-npm-user>\`.`
		: "This package is unscoped; no npm org is needed."
	return `# Publishing ${packageName}

Merges to \`main\` publish alphas; a stable release is the manual **Release** workflow.
Never run \`npm publish\` locally (see AGENTS.md).

## One-time setup

1. **Sign in to npm** on the machine you work from: \`npm login --auth-type=web\`. Open the printed
   URL within five minutes; on a headless machine run it as \`BROWSER=none npm login --auth-type=web\`.
   Verify with \`npm whoami\`.
2. ${scopeStep}
3. **Check the name is free**: \`npm view ${packageName}\` should answer 404.
4. **First publish needs a token.** npm cannot attach a trusted publisher to a package that does not
   exist yet. Create a granular access token that can publish this package, then store it:
   \`gh secret set NPM_TOKEN --repo ${repoName}\`
5. **Publish**: merge the bootstrap PR (publishes an alpha), or run the Release workflow on \`main\`
   (use \`bump = major\` to cut \`1.0.0\`). A \`release.yml\` that still has the "Skipping publish
   step" guard exits green without publishing when \`NPM_TOKEN\` is missing, so check the run really
   published: \`npm view ${packageName} dist-tags\`.
6. **Switch to trusted publishing**: on npmjs.com open the package, then Settings, then Trusted
   Publisher, and choose GitHub Actions with repository \`${repoName}\` and workflow \`release.yml\`.
7. **Remove the token**: \`gh secret delete NPM_TOKEN --repo ${repoName}\`, and set the package's
   publishing access to require 2FA and disallow tokens.
8. **Verify**: merge a small \`fix:\` PR and confirm the new alpha appears with provenance.
`
}

async function run(command: string): Promise<string> {
	const result = await $`sh -c ${command}`.nothrow().quiet()
	return result.stdout.toString().trim() || result.stderr.toString().trim()
}

/** Read-only npm status lines: who is signed in, and whether the package name is taken. */
export async function npmStatus(packageName: string): Promise<string[]> {
	const user = await run("npm whoami 2>/dev/null")
	const lookup = await run(`npm view ${packageName} version 2>&1`)
	const taken = lookup !== "" && !lookup.includes("E404")
	return [
		user ? `npm signed in as: ${user}` : "npm: not signed in (run `npm login --auth-type=web`)",
		taken
			? `npm name: ${packageName} already exists (${lookup}); first publish is not needed`
			: `npm name: ${packageName} is free (first publish still to do)`,
	]
}
