# Standards adoption and review — November 26, 2026

## Selection

- Canonical: https://github.com/towkneed/software-engineering-standards
- Reviewed branch: `sol/initial-standards`.
- Exact pin: `79530292a9bc025dbca86cbc9131de51c02d0aa9`.
- Core 0.1.0 and Browser Application Profile 0.1.0 apply.
- Question Bank Profile does not apply.
- Read: README.md, ADOPTION.md, standards/core.md,
  standards/profiles/browser-application.md and LICENSE.md.

At review time `main` contained only the starter README. The selected branch
and pin contain the substantive standards. Do not assume the default branch
supplies the selected version.

## Reproducible retrieval

Runtime has no standards-download dependency. For contributor review, retrieve
the exact source into a fresh directory (repository access may be required):

```sh
git clone https://github.com/towkneed/software-engineering-standards.git .standards/source
git -C .standards/source checkout --detach 79530292a9bc025dbca86cbc9131de51c02d0aa9
git -C .standards/source rev-parse HEAD
```

The output must equal the pin. `.standards/` is ignored. Do not overwrite an
existing checkout or silently advance its source. If retrieval is unavailable,
report the gap; this summary does not replace the normative text. Private
source files have not been copied into this public repository.

Updates require deliberate review. Justified deviations belong under
`docs/decisions/`, identifying the overridden rule, replacement, rationale,
consequences, approving decision and revisit conditions. None is selected here.
Unexecuted verification is an open acceptance gap, not a waived standard.

## Review and changes

Baseline: Quiet Composer `49e2aa6117ead1865ffb044588f737c3e0c68b19` (0.2.0).
Its initial publication lacked explicit standards adoption. Review found
unvalidated saved-setting types, insufficiently closed request/reply shapes,
and popup success text preceding confirmed persistence.

Version 0.2.1 adds the shared documented protocol, sender/record validation,
disabled/error state for bad or unreadable settings, protection against a stale
initial read, and success only after the storage write. Overlay targeting and
permissions remain unchanged. Browser fixtures now load the shared module in
production order. Test-only Playwright is pinned; runtime has no packages.
AGENTS.md, CONTRIBUTING.md and docs/architecture.md document setup, operation,
recovery, contribution, contracts and resource lifetime.

## Verification and limits

- Eight Node contract/mocked-integration tests pass with zero failures/skips:
  settings types/bounds, request/reply shapes, sender checks, CSS syntax errors,
  failure diagnostics/recovery, stale initial reads, persistence failure and
  malformed replies before a write.
- Initial candidate test run: six passes/two failures. A popup protocol binding
  was declared too late in the new patch. Moving it before first use fixed it;
  the final successful run retains all assertions.
- JavaScript syntax, manifest/script references, Python harness syntax and
  local documentation links are separately checked before publication.
- Browser attempt: `QUIET_COMPOSER_BROWSER=/usr/bin/chromium python3 tests/verify.py`
  stopped before assertions. Launcher exit was 127; stderr contained
  `/usr/lib/chromium/chromium: not found`. Playwright's managed Chromium was also
  absent. No browser pass is claimed.
- Toney's November 25 live confirmation applies to 0.2.0. There is no new live
  0.2.1 or installed-extension acceptance result.

Remaining browser-profile checks include popup keyboard use/zoom, real picker
cancellation/save failures, refresh/navigation/BFCache, editor/transcript
preservation, current ChatGPT DOM and the full browser harness. Mocked tests
do not replace these. This records adoption and bounded progress, not a full
conformance certification. Further discovered gaps remain follow-up work.
