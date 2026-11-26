# Architecture and contracts

## Components

- `content.css`: first-paint hiding of the observed inert prediction widget.
- `protocol.js`: closed storage/message contracts, loaded first in the isolated
  content-script world and popup; CommonJS export for dependency-free tests.
- `content.js`: composer targeting, editor protections, custom matches, picker
  and document-scoped settings. It changes attributes, not editor nodes.
- `popup.html` and `popup.js`: native controls, settings writes and active-tab
  messaging. Success appears only after storage confirms the write.
- `tests/contracts.test.cjs`: contracts and mocked boundary behavior.
- `tests/verify.py`: rendered synthetic pages with mocked Chrome APIs. This is
  not an installed-extension or live ChatGPT test.

The built-in CSS works before JavaScript to avoid showing predictions while
settings load. Its identifying attributes also appear in the content script's
narrow editor exception: review both and the fixture when changing the DOM
contract. A saved-off setting applies after storage loads; brief startup hiding
is expected.

## Storage

Exactly `{selector: string, enabled: boolean}`. The selector is bounded to 2,048
JavaScript string code units. Empty selects the automatic rule alone. The DOM
checks syntax before custom use. Invalid settings/read failure disable hiding,
warn in the console and expose a root diagnostic; a valid save can recover.
Normal 0.2.0 settings remain compatible without migration.

A delayed initial read cannot overwrite a newer storage-change event. Removed
settings restore their defaults. Only relevant local changes schedule work.

## Messages

The listener accepts only its own extension ID and independently validates the
payload. Accepted request and successful reply shapes are:

| Request | Reply |
| --- | --- |
| `{type: 'quiet-composer-pick'}` | `{ok: true}` |
| `{type: 'quiet-composer-check', selector: string}` | `{ok: true, count: nonnegative safe integer}` |

Errors use `{ok: false, error: nonempty string}` with at most 200 characters.
Requests/replies reject unknown fields and operations. The popup validates
replies before success; missing/stale-tab replies remain errors. No public
web-page message bridge or native process is present.

## Lifetime and bounds

One mutation observer and at most one queued animation frame belong to the
content-script document. Browser document disposal releases those resources.
Mutations coalesce into a frame; there is no timer retry chain. Custom matching
is idempotent. The automatic CSS rule needs no observer pass.

A picker owns one overlay and document Escape listener. Another picker cancels
the previous one. Escape or successful save removes overlay/listener; a failed
save leaves a visible error. Popup listeners belong to its short-lived document.
Navigation creates a new content-script document. Refresh/BFCache still need
the documented browser checks.

There are no runtime packages, network calls, analytics or remote code.
Permissions remain `storage` and `activeTab`; content scripts match only
`https://chatgpt.com/*`. DOM changes may require a new selector. Hiding does not
disable generation or guarantee that Tab cannot accept a hidden prediction.
