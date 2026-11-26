# Contributing

Quiet Composer uses plain JavaScript, HTML and CSS with no runtime packages
or build step. See AUTHORS.md for attribution and LICENSE for the MIT terms.
Follow the pinned Core and Browser Application standards in
[the adoption record](docs/standards-review-2026-11-26.md).

## Validation setup

Use Node.js 20 or newer for its built-in test runner. From the repository root:

```sh
node --test tests/contracts.test.cjs
node --check protocol.js
node --check content.js
node --check popup.js
```

The contract suite uses Node's standard library only. It validates closed
records and executes the actual content/popup scripts with mocked Chrome and
DOM boundaries. It does not render a page or load an extension into Chrome.

The browser harness uses Python 3.10 or newer and pinned Playwright. On POSIX:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/requirements.txt
.venv/bin/python -m playwright install chromium
.venv/bin/python tests/verify.py
```

On Windows, use `.venv\Scripts\python.exe` for the environment's Python
commands. Install Playwright's documented host prerequisites if it reports
missing system libraries. An existing working Chromium can be selected with
`QUIET_COMPOSER_BROWSER`; record its version with results. A launcher without
its browser binary is not usable. A launch failure is a failed verification
attempt, not a passing or silently skipped test.

## Live and keyboard checks

Load the repository folder as an unpacked extension and refresh a ChatGPT tab.
Check hiding when an actual prediction appears; confirm the editor, typed
text, transcript and Send control remain usable. Toggle hiding, clear settings,
refresh/navigate and check a new tab. Exercise popup Tab/Space/Enter, visible
focus, labels and status text at increased text size/zoom. The pointer picker
must cancel with Escape; the selector field supplies a keyboard-accessible
alternative. Source inspection alone does not establish these results.
Report browser/version and exercised checks without private chat text.

## Troubleshooting and recovery

- Stale tab: refresh ChatGPT after loading/reloading the extension.
- Invalid selector: clear the optional selector and save again.
- Corrupt settings: hiding is disabled; `data-quiet-composer-error` on the
  document root gives a diagnostic. Use Clear rule or save valid settings.
  Storage errors appear in the popup or content-script console.
- Overbroad rule: uncheck Hide suggestions or use Clear rule. Refresh after
  disabling/removing the extension to remove its visual changes.
- Changed DOM: propose a narrow rule with an anonymized fixture. Never include
  real predictions, messages or account details in an issue or fixture.

Keep changes focused. Explain behavior, rationale, validation and known limits
in the commit or PR. Add regression coverage without weakening existing tests.
Update docs and the manifest version for behavior changes. Generated ZIPs,
browser downloads, virtual environments and caches are not source files.
