# Chrome Web Store Submission Guide

This document contains ready-to-paste content and release choices for Bookmark Tidy v0.1.0. Verify the final package behavior against these answers before submitting an update.

## Store Listing

### Product details

- **Name:** Bookmark Tidy
- **Summary:** Safely scan, review, organize, and undo changes to Chrome bookmarks.
- **Primary category:** Productivity
- **Language:** English
- **Mature content:** No

### Detailed description

```text
Bookmark Tidy helps you clean and organize Chrome bookmarks without making hidden changes.

How it works:
1. Choose Scan bookmarks to analyze your bookmark library without modifying it.
2. Review duplicate, empty-folder, and organization suggestions.
3. Select only the changes you want.
4. Review the batch and explicitly confirm before anything changes.
5. Undo successful operations from the latest batch if needed.

Features:
• Finds exact duplicate bookmarks.
• Identifies likely duplicates after normalizing tracking parameters.
• Finds empty bookmark folders.
• Suggests moves into relevant existing folders.
• Revalidates every selected target before applying a change.
• Shows succeeded, failed, and skipped operation counts.
• Stores the latest operation record locally to provide an undo path.

Privacy:
Bookmark Tidy accesses bookmark titles, URLs, folder structure, identifiers, ordering, and related metadata only to provide its bookmark-management features. Analysis runs locally on your device. Bookmark information is not transmitted to the developer or third parties, and the extension contains no analytics, advertising, or telemetry services.

Bookmark Tidy uses only the Chrome bookmarks and storage permissions. It does not request access to webpage contents, browsing history, cookies, passwords, or authentication information.

Current v0.1 limitation: only the latest operation batch can be undone. Bookmarks recreated during undo receive new Chrome bookmark identifiers.
```

### URLs

- **Homepage:** https://github.com/geoffrey-xiao/bookmark-tider
- **Support:** https://github.com/geoffrey-xiao/bookmark-tider/issues
- **Privacy policy:** https://geoffrey-xiao.github.io/bookmark-tider/privacy-policy.html

### Graphic assets

- **Store icon:** `public/icons/icon-128.png`
- **Screenshot:** `store-assets/final/screenshot-manager-1280x800.png`
- **Small promotional tile:** `store-assets/final/promo-small-440x280.png`
- **Marquee promotional tile:** Not provided; optional.
- **Promotional video:** Not provided; leave blank unless the dashboard marks it as required.

## Privacy Practices

### Single purpose

```text
Bookmark Tidy helps users safely scan their Chrome bookmark library, review duplicate and organization suggestions, apply only explicitly confirmed changes, and undo successful operations from the latest batch.
```

### Permission justifications

**`bookmarks`**

```text
Required to read the user's bookmark tree, identify duplicates and organization opportunities, display proposed changes, apply only changes explicitly approved by the user, and restore affected bookmarks during undo.
```

**`storage`**

```text
Required to store the latest operation batch in chrome.storage.local so the user can review results, recover an interrupted batch, and undo successful operations. The stored record remains on the user's device.
```

### Remote code

- Select **No, this extension does not use remote code**.
- All JavaScript required by the extension is bundled in the uploaded package.
- The extension makes no external network requests.

### User-data categories

Follow the category definitions displayed in the dashboard at submission time. Local-only processing still needs to be disclosed; do not select “no user data handled” solely because information stays on the device.

Use these conservative mappings when the corresponding category is available:

- **Web history or web browsing activity:** Bookmark URLs, normalized URLs, and derived domains. Explain that these values come from the user's bookmark library, not from Chrome browsing-history access.
- **User-provided or user-generated content:** Bookmark titles and folder names, if the dashboard provides this category.
- **User activity:** Select only if the dashboard definition includes locally stored bookmark-management selections and operation records.

Do **not** declare access to webpage content, precise location, authentication information, personal communications, health information, financial information, or payment information. The extension does not access those categories.

### Data-use certifications

Certify only while the implementation continues to match these statements:

- Data is used only to provide or improve Bookmark Tidy's disclosed single purpose.
- Data is not sold or transferred to third parties.
- Data is not used or transferred for purposes unrelated to the extension's single purpose.
- Data is not used or transferred to determine creditworthiness or for lending.
- Data is not used for personalized, retargeted, or interest-based advertising.
- Humans are not allowed to read user bookmark data because it is not transmitted to the developer.
- The extension complies with the Chrome Web Store User Data Policy, including Limited Use requirements.

### Privacy policy URL

```text
https://geoffrey-xiao.github.io/bookmark-tider/privacy-policy.html
```

## Distribution

Recommended v0.1 selections:

- **Visibility:** Public
- **Regions:** All regions
- **Pricing:** Free
- **In-app purchases:** No
- **Contains ads:** No

Use deferred publishing during the first submission so the approved listing can be checked before it becomes public. After approval, publish within the dashboard's staging window.

## Reviewer Test Instructions

No account, server, subscription, or test credentials are required. The extension works entirely with Chrome bookmarks.

```text
1. Before testing, create a Chrome bookmark folder named “Bookmark Tidy Review Test”.
2. Inside it, create two bookmarks with the same title and URL, and create one empty subfolder.
3. Open Bookmark Tidy from the toolbar and choose “Open manager”.
4. Choose “Scan bookmarks”. Verify that scanning itself does not change the bookmark library.
5. Confirm that the duplicate bookmark and empty folder appear as cleanup suggestions.
6. Select only those prepared test suggestions and choose “Review selected changes”.
7. Verify that the confirmation dialog lists the proposed deletions and explains that a snapshot is saved.
8. Confirm the batch and verify that its succeeded, failed, and skipped counts are displayed.
9. Choose “Undo latest batch”, review the undo confirmation, and confirm it.
10. Verify that the deleted test bookmark and folder are restored. Recreated nodes receive new Chrome bookmark IDs.

The extension does not make network requests. No external service needs to be available during review.
```

## Final Package Checklist

Run from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Create the upload archive from inside `dist` so `manifest.json` is at the ZIP root:

```sh
cd dist
zip -r ../bookmark-tidy-0.1.0.zip .
```

Before uploading, confirm:

- `manifest.json`, `background.js`, `popup.html`, and `manager.html` are at the package root.
- All icon paths declared in the manifest exist in the archive.
- No source files, test files, design masters, or store-listing graphics are included in the extension package.
- The ZIP version is greater than every version previously uploaded for this store item.
- The listing, privacy answers, and hosted privacy policy describe the same implementation.
