# Dev Notes

## Commit Hygiene

1. If dependencies change, commit dependency files separately.
   - Include `package.json` and `package-lock.json` in the same dependency commit.
   - Keep dependency updates out of feature/refactor commits.
2. Keep functional code commits separate from tooling/dependency commits.
   - `feat(...)` / `fix(...)` commits should focus on behavior changes.
   - `chore(...)` commits should focus on infra, CI, or dependency maintenance.

## Boy Scout vs Scope Creep

1. Apply only the minimum cleanup needed to safely complete the current task.
2. If you see cosmetic, behavior-neutral refactors, split them into a separate commit.
3. Do not expand task scope while touching nearby code.

## Commit Message Examples

- `chore(deps): update lockfile and dependency versions`
- `chore(quality): adjust CI scripts and thresholds`
- `feat(...)/fix(...): functional code changes`

## Intentional Separations

**ADR: web vs. kasa API clients are intentionally separate.**
`web/src/lib/api.ts` and `kasa/src/lib/api.ts` must not be merged.
Why: web is a read-only browser dashboard (same-origin, Vite proxy).
kasa is a read-write Electron app requiring dynamic baseUrl (LAN IP) and per-request terminalId injection.
Merging would leak Electron-specific config into the browser bundle.
Revisit only if web gains write operations or Electron is dropped.

## Feature Development Order

When adding a new feature across packages, always start from shared:

1. `packages/shared/src/` — types and constants first
2. Server route + service
3. web/kasa store
4. UI

**Why:** The compiler immediately flags every package that hasn't implemented
the new type yet. Prevents "works on web, broken on kasa" bugs.
