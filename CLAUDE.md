# VoiceBox MCP Guidelines & Runbook

VoiceBox is a biophysical vocal tract synthesis engine and MCP server built with Bun, TypeScript, and a native C-ABI waveguide engine.

## Development Commands

- Run test suite: `bun test` (all 80 tests must pass)
- Start MCP server on stdio: `bun run src/index.ts`
- CLI test: `bun run cli.ts speak "Hello world" --subtext curiosity --play`
- Perform reflex gesture: `bun run cli.ts gesture sigh --play`
- Check vocal identity: `bun run cli.ts identity`

## Agent Skills

The official agent operational skill is located at:
- `skills/voicebox/SKILL.md`
- `.agents/skills/voicebox/SKILL.md`
- `.claude/skills/voicebox/SKILL.md`

Always refer to `skills/voicebox/SKILL.md` for tool usage patterns, subtext selection guidelines, and physiological gesture mappings.
