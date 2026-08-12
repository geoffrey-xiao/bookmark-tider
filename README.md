# Bookmark Tidy

A safety-first Chrome Manifest V3 extension for scanning, cleaning, and organizing bookmarks. The core product rule is: analyze first, review changes, then apply—with an undo path.

v0.2 extends the completed [three-day MVP roadmap](bookmark_tidy_docs/Bookmark_Tidy_MVP_迭代路线图.md) with versioned local operation history and optional AI-assisted classification into existing folders. The larger engineering checklist remains the source backlog.

## Getting started

```sh
npm install
npm run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the generated `dist` directory.

During development, run `npm run dev` for page work. Rebuild before reloading the unpacked extension when testing the service worker or manifest.

## Browser-specific release builds

The default build targets the Chrome Web Store. The Edge build uses the same application code but replaces the generated manifest description with Microsoft Edge-specific listing text.

```sh
# Chrome: creates release/bookmark-tidy-chrome-0.2.0.zip
npm run package:chrome

# Microsoft Edge: creates release/bookmark-tidy-edge-0.2.0.zip
npm run package:edge
```

To test the Edge build before packaging, run `npm run build:edge`, open `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist`.

## v0.2 safety check

Before using the extension on a real library, create a dedicated test folder with duplicate bookmarks, an empty subfolder, and a bookmark that can be moved to another existing folder. Then:

1. Scan and confirm that no bookmark changes during analysis.
2. Select only the prepared test items and review their before/after details.
3. Apply the batch and verify its success, failure, and skipped counts.
4. Choose **Undo latest batch** and confirm titles, URLs, parent folders, and ordering are restored. Deleted nodes are recreated with new Chrome IDs.

v0.2 keeps up to 50 operation batches in `chrome.storage.local` and automatically migrates the v0.1 latest-batch record. Earlier batches are read-only; only the newest eligible apply batch can be undone, and that undo is saved as a separate batch.

AI classification is disabled by default and uses the user's own OpenAI API key. Domain-only mode sends opaque local references, bookmark domains, and existing folder names. The optional title-and-domain mode also sends bookmark titles and current folder names. Full bookmark URLs and operation history are never sent. AI output only creates unselected review suggestions; the existing confirmation and undo safeguards still apply.

## Quality commands

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Module boundaries

- `src/background`: service-worker orchestration and message handling.
- `src/pages`: popup and full-page manager UI. UI code must not call Chrome APIs directly.
- `src/chrome`: adapters for runtime and browser APIs.
- `src/bookmark`: bookmark adapter, read-only analysis, and the sole operation/undo engine.
- `src/rules`: deterministic categorization rules; never modifies bookmarks.
- `src/storage`: versioned settings, history, and snapshot persistence.
- `src/types`: shared versioned message and domain types.
- `src/utils`: dependency-free shared utilities.

All Chrome API access belongs behind an adapter. Analysis modules only output suggestions; bookmark writes belong exclusively to the operation engine.

Product and engineering plans are under `bookmark_tidy_docs/`.

## Privacy

Bookmark Tidy processes cleanup and rule-based classification locally. If the user explicitly enables AI classification, minimized bookmark fields are sent directly to OpenAI as described in the [privacy policy](docs/privacy-policy.md). The extension contains no analytics, advertising, or developer telemetry.

Release managers can use the [Chrome Web Store submission guide](docs/chrome-web-store-submission.md) for listing copy, privacy disclosures, reviewer instructions, distribution settings, and packaging checks.

For Microsoft Edge Add-ons, use the [Edge submission guide](docs/edge-add-ons-submission.md) and the dedicated [Edge privacy policy](docs/privacy-policy-edge.html).
