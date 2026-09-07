# Vendored skill attribution

The unmodified `sharp-edges` and `property-based-testing` skills in `.agents/skills`
are by Trail of Bits, copied from https://github.com/trailofbits/skills at commit
`d3323cefbcf645678b8dc481de204b02ad3d02dc`. Their bundled references and assets retain
the upstream Creative Commons Attribution-ShareAlike 4.0 license included here.

The `vercel-react-best-practices` skill is by Vercel, from
https://github.com/vercel-labs/agent-skills, installed with Skills CLI 1.5.23 on
2026-09-06. Its SKILL.md declares MIT. The source hash is in skills-lock.json.
These development references are not part of the packaged application.

Upstream catalog audit badges are screening signals, not attestations from this
project. Review updates, including references/scripts, before replacing the copies.

Additional reviewed skills installed on 2026-09-06:

- `vercel-composition-patterns` and `web-design-guidelines`: Vercel's own
  `vercel-labs/agent-skills`, commit `063bee94c3f4df8453406c830b0a7df0f2860278`.
  Copies are unmodified. Composition declares MIT; the UI skill references Vercel's
  externally maintained Web Interface Guidelines, whose contents are fetched when used.
- `vite`: Anthony Fu's `antfu/skills`, commit
  `a74f281a27dadc02397bc1a174b0f2c97531b6ae`. Unmodified documentation-generated
  skill; its upstream MIT license is included in antfu-MIT.txt.

Content hashes for these copies are in skills-lock.json. Project-authored integration
notes in docs/stack-guidance.md are clearly separate from these upstream skills.
