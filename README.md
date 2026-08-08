# Bookmark Tidy

A safety-first Chrome Manifest V3 extension for scanning, cleaning, and organizing bookmarks. The core product rule is: analyze first, review changes, then apply—with an undo path.

The active v0.1 delivery plan is the [three-day MVP roadmap](bookmark_tidy_docs/Bookmark_Tidy_MVP_迭代路线图.md). The larger engineering checklist is retained as the v0.2+ backlog.

## Getting started

```sh
npm install
npm run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the generated `dist` directory.

During development, run `npm run dev` for page work. Rebuild before reloading the unpacked extension when testing the service worker or manifest.

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
- `src/bookmark`: bookmark adapter and read-only domain analysis.
- `src/rules`: deterministic categorization rules; never modifies bookmarks.
- `src/storage`: versioned settings, history, and snapshot persistence.
- `src/types`: shared versioned message and domain types.
- `src/utils`: dependency-free shared utilities.

All Chrome API access belongs behind an adapter. Analysis modules output data or suggestions; future bookmark writes belong exclusively to the operation engine.

Product and engineering plans are under `bookmark_tidy_docs/`.
