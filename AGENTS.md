# Engineering guidance

Read README.md, CONTRIBUTING.md and docs/architecture.md before changing code.
Apply Core Software Engineering Standards 0.1.0 and Browser Application Profile
0.1.0 at the exact source commit in docs/standards-review-2026-11-26.md.
That record documents reproducible retrieval and current verification gaps.

Keep runtime dependencies and permissions minimal. Validate stored settings,
extension senders, requests and replies at their boundaries. Preserve the
composer editor, transcript and controls when changing overlay targeting.
Keep DOM selector-syntax checks separate from transport-shape checks.

Use JSDoc for shared and non-obvious JavaScript contracts. Document ownership
of asynchronous operations, listeners and document-scoped state. Preserve
initial-read versus newer-change ordering and successful-write confirmation.

Run focused contract tests and broader available checks. For DOM, popup,
picker, lifecycle or accessibility changes, exercise browser and live/manual
checks where available. Report unavailable checks explicitly; mocked APIs
are not installed-extension acceptance evidence. Record justified standards
deviations rather than silently changing the selected requirements.
Preserve existing authorship and licensing.
