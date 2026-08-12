# Bookmark Tidy Privacy Policy

**Effective date:** August 13, 2026

Bookmark Tidy is a Chrome extension that helps users scan, review, organize, and undo changes to their Chrome bookmarks. This policy explains what information the extension accesses, how it is used, and how it is stored.

## Information Bookmark Tidy accesses

When you choose to scan your bookmarks, Bookmark Tidy accesses the bookmark tree provided by the Chrome Bookmarks API. This can include:

- bookmark titles and URLs;
- folder names and folder structure;
- bookmark and folder identifiers;
- bookmark position and ordering;
- bookmark creation timestamps, when Chrome provides them; and
- derived information such as normalized URLs, domains, duplicate groups, and organization suggestions.

Bookmark Tidy does not request access to webpage contents, browsing history, passwords, cookies, authentication information, payment information, or personal communications.

## How the information is used

Bookmark information is used only to provide Bookmark Tidy's user-facing features:

- scan the bookmark library;
- identify duplicate bookmarks and empty folders;
- suggest bookmark organization changes;
- display proposed changes for review;
- apply only the changes the user explicitly selects and confirms; and
- undo successful operations from the latest batch.

Bookmark Tidy does not use bookmark information for advertising, profiling, credit decisions, or any unrelated purpose.

## Local processing and storage

Duplicate detection, empty-folder detection, and rule-based classification are performed locally in the extension on the user's device.

To provide operation history and undo, Bookmark Tidy stores up to 50 operation batches in `chrome.storage.local`. These records can contain bookmark metadata associated with reviewed operations, including titles, URLs, identifiers, folder locations, ordering, operation status, and error details. Older records are removed as the bounded history fills. The remaining records stay in local extension storage until the extension's local data is cleared through Chrome or the extension is uninstalled.

## Optional AI classification

AI classification is disabled by default. If the user enables it, supplies their own OpenAI API key, and selects **Run AI classification**, Bookmark Tidy sends a minimized batch directly to OpenAI so the model can suggest an existing destination folder.

- **Domain-only mode:** sends opaque per-request references, bookmark domains, and existing folder names.
- **Title-and-domain mode:** additionally sends bookmark titles and current folder names.
- Full bookmark URLs, Chrome bookmark identifiers, and operation-history records are not sent.
- Requests specify `store: false`. OpenAI's processing remains subject to the user's OpenAI account and OpenAI's applicable terms and data controls.
- AI results are unselected suggestions. They cannot modify bookmarks without the normal review and confirmation steps.

The user's OpenAI API key is stored in `chrome.storage.local` and is sent only to `api.openai.com` for authenticated requests. It is not returned to the extension page after it has been saved. Users should use a restricted project key and monitor or revoke it through their OpenAI account.

## Data transmission and sharing

Bookmark Tidy does not transmit bookmark information or operation records to the developer. It does not include analytics, telemetry, or advertising services. Minimized bookmark fields are transmitted to OpenAI only through the explicit, optional AI workflow described above.

Bookmark Tidy does not sell, rent, share, or otherwise transfer user data to third parties.

## Permissions

Bookmark Tidy requests only these Chrome permissions:

- **`bookmarks`:** used to read the bookmark tree, show cleanup and organization suggestions, apply user-confirmed changes, and restore affected bookmarks during undo.
- **`storage`:** used to save bounded operation history locally so the user can review prior results and undo the newest eligible batch.
- **Host access to `https://api.openai.com/*`:** used only for user-initiated AI classification requests.

## User choices and control

Scanning begins only when the user selects the scan action. Local scanning itself does not modify bookmarks. AI transmission requires AI to be enabled and the user to select the AI action. Bookmark changes require the user to select suggestions and confirm the batch before it is applied.

Users can remove a saved OpenAI key from AI settings. They can remove all locally stored operation records and settings by clearing the extension's data through Chrome or uninstalling the extension. Uninstalling Bookmark Tidy does not reverse bookmark changes that were already applied.

## Security

Bookmark Tidy keeps operation history within the extension and Chrome's local extension storage. Optional AI requests minimize transmitted fields and never include full bookmark URLs. Users should protect access to their device, Chrome profile, and locally stored OpenAI API key.

## Limited Use disclosure

Bookmark Tidy's use of information obtained from Chrome APIs is limited to providing and improving its single purpose: helping users safely scan, review, organize, and undo changes to their bookmarks.

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Children's privacy

Bookmark Tidy is a general productivity tool and is not directed to children under 13. The extension does not knowingly collect personal information from children.

## Changes to this policy

This policy may be updated when Bookmark Tidy's functionality or data practices change. The effective date at the top of this page will be revised when an update is published. Material changes will be disclosed as required by applicable Chrome Web Store policies.

## Contact

Questions or concerns about this privacy policy can be submitted through the [Bookmark Tidy GitHub issue tracker](https://github.com/geoffrey-xiao/bookmark-tider/issues).
