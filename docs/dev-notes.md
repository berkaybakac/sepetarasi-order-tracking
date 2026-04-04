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
