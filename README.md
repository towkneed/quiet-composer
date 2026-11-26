# Quiet Composer 0.2.0

A small Chrome/Edge Manifest V3 extension that hides ChatGPT composer predictions. It targets the actual `data-cumberbatch` widget supplied from the live composer. No picking or custom selector is needed for this widget.

## Authors

**Designed and implemented by Sol**, a ChatGPT AI assistant, in collaboration
with **Toney Biegalski**, who proposed the tool, investigated the live composer
markup, supplied requirements and performed live testing. See [AUTHORS.md](AUTHORS.md).

## Install or update

1. Download this repository using **Code → Download ZIP**, then extract it to a permanent folder, or clone the repository. The extension folder is the directory containing `manifest.json`. To update an existing installation, replace its files with the current source.
2. Open `chrome://extensions` (or `edge://extensions`).
3. For an update, click the extension's Reload button. For a new install, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Refresh your ChatGPT tab. Open the extension, ensure **Hide suggestions** is checked, and Save. You can remove the old custom selector; leave the checkbox checked and Save.

## Exact widget rule

The built-in CSS targets `[data-composer-input] .ProseMirror [data-cumberbatch][inert][aria-hidden="true"][contenteditable="false"]`. It hides the non-editable prediction widget without deleting or changing ProseMirror's nodes. The editor and paragraph remain intact. CSS also applies when the widget is inserted or replaced, without waiting for JavaScript mutation handling.

The optional picker/custom selector remain available for other overlays. A narrow exception permits selecting the identified inert, non-editable widget and its descendants even though they are inside ProseMirror; the editor itself and normal typed content remain protected. Escape cancels picking. Zero custom matches may simply mean no prediction is present.

Open the popup and uncheck **Hide suggestions**, then Save, to restore them. **Clear rule** switches hiding off and removes the custom selector. Disabling/removing the extension stops future hiding; reload an already-open ChatGPT tab to remove existing visual changes. Hiding defaults on during startup; a saved off setting applies when local storage finishes loading.

## Scope and limits

- Runs only on `https://chatgpt.com/*`; it has no network calls, analytics, or remote code. One selector and its enabled state are stored locally.
- Hides only eligible elements within detected composer containers. Your messages are not deleted or sent by this extension.
- Uses visibility/opacity rather than deleting nodes, and reapplies its rule when the page rerenders.
- This hides the visual overlay. It does **not** disable prediction generation, change account settings, or reliably prevent Tab-to-accept. Avoid Tab when you do not intend to accept a prediction.
- The built-in selector was checked against a fixture matching the observed markup. JavaScript syntax, manifest references and the original ZIP integrity passed. Toney reported that suggestion hiding worked in his live ChatGPT session on November 25, 2026. This is user-reported live validation, not an automated browser-test result. The included synthetic browser harness has not been run successfully in the development environment because its browser executable was unavailable.
- A stable `data-testid`, ID, or semantic class is preferred when available. A positional fallback may stop matching or hide a different non-editable composer element after layout changes; re-pick or clear it if that happens.
- Ordinary editable text, placeholder attributes and CSS pseudo-elements are not separate targets for this picker. Only the identified widget has an exception inside the editor. An upstream DOM change may require adjusting the rule.
- The absence of a suggestion after refresh alone does not prove hiding works. Check the next occurrence; hidden widget text should remain present in the DOM, with CSS visibility set to hidden.

Source files are included; no build step is required.

Optional synthetic checks: install Python Playwright and its Chromium browser, then run `python tests/verify.py`. To use an existing browser executable, set `QUIET_COMPOSER_BROWSER` to its path. These checks do not substitute for testing your live ChatGPT composer.

Chrome content-script reference: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts

## License

[MIT](LICENSE), as selected for this repository. Authorship and collaboration
credits are recorded separately in [AUTHORS.md](AUTHORS.md).
