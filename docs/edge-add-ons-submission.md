# Microsoft Edge Add-ons Submission Guide

This document contains ready-to-paste content and release choices for Bookmark Tidy v0.1.0. Verify the final Edge package behavior against these answers before submitting an update.

Official references:

- [Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- [Microsoft Edge Add-ons developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)
- [Port a Chrome extension to Microsoft Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension)

## Store Listing

### Product details

- **Name:** Bookmark Tidy
- **Short description:** Safely scan, review, organize, and undo changes to Microsoft Edge favorites.
- **Primary category:** Productivity
- **Language:** English
- **Mature content:** No

### Detailed description

```text
Bookmark Tidy helps you clean and organize Microsoft Edge favorites without making hidden changes.

How it works:
1. Choose Scan bookmarks to analyze your favorites library without modifying it.
2. Review duplicate, empty-folder, and organization suggestions.
3. Select only the changes you want.
4. Review the batch and explicitly confirm before anything changes.
5. Undo successful operations from the latest batch if needed.

Features:
• Finds exact duplicate favorites.
• Identifies likely duplicates after normalizing tracking parameters.
• Finds empty favorites folders.
• Suggests moves into relevant existing folders.
• Revalidates every selected target before applying a change.
• Shows succeeded, failed, and skipped operation counts.
• Stores the latest operation record locally to provide an undo path.

Privacy:
Bookmark Tidy accesses favorite titles, URLs, folder structure, identifiers, ordering, and related metadata only to provide its favorites-management features. Analysis runs locally on your device. Favorite information is not transmitted to the developer or third parties, and the extension contains no analytics, advertising, or telemetry services.

Bookmark Tidy uses only the Microsoft Edge bookmarks and storage permissions. It does not request access to webpage contents, browsing history, cookies, passwords, or authentication information.

Current v0.1 limitation: only the latest operation batch can be undone. Favorites recreated during undo receive new Microsoft Edge bookmark identifiers.
```

### URLs

- **Website:** https://github.com/geoffrey-xiao/bookmark-tider
- **Support:** https://github.com/geoffrey-xiao/bookmark-tider/issues
- **Privacy policy:** https://geoffrey-xiao.github.io/bookmark-tider/privacy-policy-edge.html

### Graphic assets

- **Extension logo:** `public/icons/icon-128.png` (accepted minimum; a 300 x 300 version is recommended)
- **Screenshot:** `store-assets/final/screenshot-manager-1280x800.png`
- **Small promotional tile:** `store-assets/final/promo-small-440x280.png`
- **Large promotional tile:** Not provided; optional.
- **YouTube video:** Not provided; optional.

Capture a replacement screenshot in Microsoft Edge before submission if the existing image visibly includes Chrome-specific browser UI.

## Privacy

### Single purpose

```text
Bookmark Tidy helps users safely scan their Microsoft Edge favorites, review duplicate and organization suggestions, apply only explicitly confirmed changes, and undo successful operations from the latest batch.
```

### Permission justifications

**`bookmarks`**

```text
Required to read the user's favorites tree, identify cleanup and organization opportunities, display proposed changes, apply only changes explicitly approved by the user, and restore affected favorites during undo.
```

**`storage`**

```text
Required to store the latest operation batch locally so the user can review results, recover an interrupted batch, and undo successful operations. The stored record remains on the user's device.
```

### Remote code

- Select **No, I am not using remote code**.
- All JavaScript required by the extension is bundled in the uploaded package.
- The extension makes no external network requests.

### Data usage

Follow the definitions displayed in Partner Center at submission time. Disclose accessed favorite information conservatively even though processing and storage remain local.

When corresponding categories are available, disclose:

- Favorite URLs, normalized URLs, and derived domains. Clarify that these come from the user's favorites library, not from Edge browsing-history access.
- Favorite titles and folder names as user-provided or user-generated content when that category is available.
- Locally stored management selections and operation records only when a displayed category covers them.

Do not declare access to webpage content, precise location, authentication information, personal communications, health information, financial information, or payment information. The extension does not access those categories.

Certify the disclosures only while the implementation continues to match them:

- Data is used only to provide Bookmark Tidy's disclosed single purpose.
- Data is not sold or transferred to third parties.
- Data is not used for advertising, profiling, creditworthiness, or unrelated purposes.
- Bookmark information is not read by the developer because it is not transmitted off the user's device.

### Privacy policy URL

```text
https://geoffrey-xiao.github.io/bookmark-tider/privacy-policy-edge.html
```

Open the URL in a private browser window before submission and confirm it is publicly accessible.

## Availability and Properties

Recommended v0.1 selections:

- **Visibility:** Public
- **Markets:** All markets
- **Category:** Productivity
- **Mature content:** No
- **Pricing:** Free
- **In-product purchases:** No
- **Contains ads:** No

## Search Terms

Partner Center permits up to seven search terms containing no more than 21 words in total. Suggested terms:

```text
bookmark organizer
favorites organizer
duplicate bookmarks
bookmark cleanup
favorites cleanup
bookmark manager
productivity
```

## Certification Test Instructions

No account, server, subscription, or test credentials are required. The extension works entirely with Microsoft Edge favorites on the user's device.

```text
1. Before testing, create a Microsoft Edge favorites folder named “Bookmark Tidy Review Test”.
2. Inside it, create two favorites with the same title and URL, and create one empty subfolder.
3. Open Bookmark Tidy from the toolbar and choose “Open manager”.
4. Choose “Scan bookmarks”. Verify that scanning itself does not change the favorites library.
5. Confirm that the duplicate favorite and empty folder appear as cleanup suggestions.
6. Select only those prepared test suggestions and choose “Review selected changes”.
7. Verify that the confirmation dialog lists the proposed deletions and explains that a snapshot is saved.
8. Confirm the batch and verify that its succeeded, failed, and skipped counts are displayed.
9. Choose “Undo latest batch”, review the undo confirmation, and confirm it.
10. Verify that the deleted test favorite and folder are restored. Recreated nodes receive new Microsoft Edge bookmark IDs.

The extension does not make network requests. No external service needs to be available during review.
```

## Build and Package

Run from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run package:edge
```

The packaging command creates:

```text
release/bookmark-tidy-edge-0.1.0.zip
```

The normal `npm run build` and `npm run package:chrome` commands retain the Chrome-specific manifest. `npm run build:edge` applies `config/edge-manifest-overrides.json` only to the generated `dist/manifest.json`.

Before uploading, confirm:

- `manifest.json`, `background.js`, `popup.html`, and `manager.html` are at the ZIP root.
- The manifest description refers to Microsoft Edge rather than Chrome.
- All icon paths declared in the manifest exist in the archive.
- No source files, tests, design masters, or store-listing graphics are included.
- The manifest version is greater than every version previously uploaded for this Edge store item.
- The listing, Partner Center privacy answers, and hosted Edge privacy policy describe the same implementation.

## Submission

1. Register for the Microsoft Edge program in Partner Center if needed.
2. In the Edge workspace, choose **Create new extension**.
3. Upload `release/bookmark-tidy-edge-0.1.0.zip`.
4. Complete Availability, Properties, Privacy, and Store listings using this guide.
5. Add the certification notes above.
6. Submit the extension for certification.
7. If certification finds an issue, correct it, increment the manifest version when required, rebuild the Edge package, and resubmit.
