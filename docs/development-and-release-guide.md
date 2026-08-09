# Bookmark Tidy Development and Release Guide

This playbook captures the development and release process used for Bookmark Tidy v0.1.0. It supports browser-specific releases: finishing an Edge release does not require publishing the same version to the Chrome Web Store.

Use `X.Y.Z` below as the release version, for example `0.1.0`.

## Release definition

A browser release is complete from the engineering side when its code, automated checks, manual browser test, package, policies, and store assets are ready. A store release becomes public only after the relevant store approves it.

- [ ] Choose the target browser: Chrome, Microsoft Edge, or both.
- [ ] Choose the release version: `X.Y.Z`.
- [ ] Record whether each browser is in scope, deferred, submitted, or published.
- [ ] Confirm that publishing one browser is not being treated as a dependency of the other.

For v0.1.0, Microsoft Edge was submitted first and Chrome publication was deferred.

## Branch strategy

The v0.1.0 Edge release used the following branches:

- `develop`: stable development baseline; it remained unchanged during the Edge-only release.
- `edge_extension_release_0.1.0`: Edge-specific implementation and release preparation.
- `bookmark_undo_fix_0.1.0`: focused fix based on the Edge branch and merged back into it.
- `release_0.1.0`: final release branch created from `develop`; the Edge branch was merged into this branch.

Recommended checklist:

- [ ] Update local remote references: `git fetch origin --prune`.
- [ ] Confirm the starting commit and clean working tree: `git status -sb`.
- [ ] Create `edge_extension_release_X.Y.Z` from the agreed baseline.
- [ ] Keep browser-specific manifest, documentation, and packaging changes on the browser branch.
- [ ] For a release-blocking fix, create a narrowly named fix branch from the browser branch.
- [ ] Open the fix PR back to the browser branch, not automatically to `develop`.
- [ ] Resolve conflicts and run the full validation suite before merging the fix.
- [ ] Create `release_X.Y.Z` from `develop` when the release candidate is ready.
- [ ] Open or retarget the browser release PR to `release_X.Y.Z`.
- [ ] Merge the browser release PR into `release_X.Y.Z`.
- [ ] Verify that `develop` has not moved if the release is intentionally isolated.
- [ ] Perform final store-asset corrections directly on `release_X.Y.Z` only when that is the agreed release workflow.

Do not delete release or browser branches until certification is complete and the team no longer needs their exact history.

## Development checklist

- [ ] Install dependencies with `npm ci`.
- [ ] Keep browser APIs behind adapters in `src/chrome`.
- [ ] Keep scanning and analysis read-only.
- [ ] Keep bookmark writes inside the operation engine.
- [ ] Require the user to review and confirm changes before applying them.
- [ ] Preserve an undo path for the latest successful operation batch.
- [ ] Add or update tests for behavior changes and regressions.
- [ ] Verify that privacy statements still match the implementation.
- [ ] Confirm that no analytics, advertising, telemetry, or unexpected network requests were introduced.

## Automated validation

Run the complete suite from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npm test
```

- [ ] TypeScript type checking passes.
- [ ] ESLint passes.
- [ ] All tests pass.
- [ ] New behavior has regression coverage.
- [ ] Failures are fixed rather than ignored for packaging.

## Manual browser validation

### Microsoft Edge

```sh
npm run build:edge
```

Open `edge://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `dist`.

### Google Chrome

```sh
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `dist`.

### Safety test fixture

- [ ] Create a dedicated test folder in the target browser.
- [ ] Add two favorites with the same title and URL.
- [ ] Add an empty subfolder.
- [ ] Optionally add a favorite that can be moved to an existing folder.
- [ ] Scan and verify that scanning does not modify favorites.
- [ ] Confirm duplicate and empty-folder suggestions appear.
- [ ] Select only prepared test items.
- [ ] Review the proposed changes before confirming.
- [ ] Apply the batch and verify succeeded, failed, and skipped counts.
- [ ] Undo the latest batch.
- [ ] Verify titles, URLs, folders, and ordering are restored.
- [ ] Remember that recreated favorites receive new browser bookmark IDs.
- [ ] Remove the test fixture manually when it is no longer needed.

## Version and package preparation

- [ ] Set the same `X.Y.Z` version in `package.json` and `public/manifest.json`.
- [ ] Confirm the version is greater than every version previously uploaded for the same store item.
- [ ] Review `config/edge-manifest-overrides.json` for Edge-specific values.
- [ ] Confirm the Edge manifest description refers to Microsoft Edge.
- [ ] Confirm the Chrome manifest description refers to Chrome.

Build the required package:

```sh
# Microsoft Edge
npm run package:edge

# Google Chrome
npm run package:chrome
```

Expected output:

```text
release/bookmark-tidy-edge-X.Y.Z.zip
release/bookmark-tidy-chrome-X.Y.Z.zip
```

Package verification:

- [ ] `manifest.json` is at the ZIP root.
- [ ] `background.js`, `popup.html`, and `manager.html` are at the ZIP root.
- [ ] Every icon referenced by the manifest exists.
- [ ] The manifest uses Manifest V3.
- [ ] The package contains no source files, tests, design masters, or store-listing graphics.
- [ ] The manifest version matches `package.json`.
- [ ] Install the exact packaged build in the target browser and repeat the critical manual test.

## Store assets

- [ ] Confirm each filename extension matches the file's actual encoding.
- [ ] Check image type and dimensions with `file` and `sips` on macOS.
- [ ] Upload the extension logo.
- [ ] Upload at least one clear screenshot.
- [ ] Upload the small promotional tile when required.
- [ ] Treat the large promotional tile and video as optional unless Partner Center marks them required.
- [ ] Confirm screenshots do not show another browser's branding or private user data.

Current assets:

- Logo: `public/icons/icon-128.png`
- Manager screenshot: `store-assets/final/screenshot-manager-1280x800.png`
- Small promotional tile: `store-assets/final/promo-small-440x280.png`

## Privacy and public documentation

- [ ] Keep the Chrome policy at `docs/privacy-policy.html`.
- [ ] Keep the Edge policy at `docs/privacy-policy-edge.html`.
- [ ] Ensure the Edge policy refers primarily to Microsoft Edge.
- [ ] Confirm both public URLs work in a private browser window.
- [ ] Verify that permissions, data disclosures, and policy text describe the same implementation.
- [ ] Disclose locally accessed favorite URLs, titles, and folder names conservatively when the store asks.
- [ ] State that bookmark processing remains local and is not transmitted to the developer or third parties.
- [ ] State that the extension does not use remote code.
- [ ] Keep GitHub Pages on a branch containing both policy pages.

Browser-specific submission copy is maintained in:

- [Microsoft Edge Add-ons Submission Guide](edge-add-ons-submission.md)
- [Chrome Web Store Submission Guide](chrome-web-store-submission.md)

## Microsoft Edge Partner Center submission

- [ ] Register for the Microsoft Edge program using an Individual or Company account as appropriate.
- [ ] For an individual developer, choose **Individual** and enter an available publisher display name you have the right to use.
- [ ] Read and personally accept any developer agreement presented by Microsoft.
- [ ] Create a new extension in the Edge workspace.
- [ ] Upload `release/bookmark-tidy-edge-X.Y.Z.zip`.
- [ ] Resolve all package-validation errors.
- [ ] Complete **Availability**.
- [ ] Complete **Properties**.
- [ ] Complete **Privacy**, including the single-purpose statement and permission justifications.
- [ ] Add the Edge privacy-policy URL.
- [ ] Complete every required language under **Store listings**.
- [ ] Upload valid store graphics.
- [ ] Add certification testing notes from the Edge submission guide.
- [ ] Review all answers for consistency.
- [ ] Select **Publish** to submit for certification.
- [ ] Record the submission date and submitted package version.

## Certification and publication

- [ ] Monitor Partner Center and the registered email address.
- [ ] Track the progression from **In review** to **Waiting to publish** to **In the store**.
- [ ] Do not cancel and resubmit while certification is active unless a correction is necessary.
- [ ] If review fails, save the complete certification report.
- [ ] Reproduce and fix the reported issue on a dedicated fix branch.
- [ ] Increase the manifest version when Microsoft requires a new package version.
- [ ] Rebuild, retest, and resubmit.
- [ ] After approval, open the public listing in a private browser window.
- [ ] Install the public store build and run a smoke test.
- [ ] Save the public listing URL in the repository documentation.

## Git and release record

- [ ] Commit only intended release changes.
- [ ] Push the final `release_X.Y.Z` branch.
- [ ] Confirm the working tree is clean.
- [ ] Record the final commit SHA.
- [ ] Record automated test results and the package filename.
- [ ] Record which stores were submitted and which were deferred.
- [ ] Create a version tag or GitHub Release when the chosen release policy calls for it.
- [ ] Attach checksums or release packages to the GitHub Release if binary provenance is required.

## v0.1.0 release record

- [x] Microsoft Edge implementation completed.
- [x] Edge-specific package generated: `bookmark-tidy-edge-0.1.0.zip`.
- [x] Automated checks passed.
- [x] Exact Edge build manually tested, including apply and undo.
- [x] Edge privacy policy published.
- [x] Partner Center listing content and assets prepared.
- [x] Invalid screenshot encoding corrected to a genuine PNG.
- [x] Edge extension submitted for certification.
- [x] Final release branch pushed: `release_0.1.0`.
- [ ] Microsoft certification approved.
- [ ] Public Edge Add-ons listing smoke-tested.
- [ ] Chrome Web Store submission completed — intentionally deferred and not required to finish the Edge-first v0.1.0 engineering release.

