# Bookmark Tidy Privacy Policy

**Effective date:** August 9, 2026

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

Bookmark analysis is performed locally in the extension on the user's device.

To provide the undo feature, Bookmark Tidy stores the latest operation batch in `chrome.storage.local`. That record can contain bookmark metadata associated with the reviewed operation, including titles, URLs, identifiers, folder locations, ordering, operation status, and error details. The latest record remains in local extension storage until it is replaced by a later batch, the extension's local data is cleared through Chrome, or the extension is uninstalled.

## Data transmission and sharing

Bookmark Tidy does not transmit bookmark information or operation records to the developer or to external servers. It does not include analytics, telemetry, advertising services, or other third-party data services.

Bookmark Tidy does not sell, rent, share, or otherwise transfer user data to third parties.

## Permissions

Bookmark Tidy requests only these Chrome permissions:

- **`bookmarks`:** used to read the bookmark tree, show cleanup and organization suggestions, apply user-confirmed changes, and restore affected bookmarks during undo.
- **`storage`:** used to save the latest operation batch locally so the user can review results and undo that batch.

## User choices and control

Scanning begins only when the user selects the scan action. Scanning itself does not modify bookmarks. Bookmark changes require the user to select suggestions and confirm the batch before it is applied.

Users can remove Bookmark Tidy's locally stored operation record by clearing the extension's data through Chrome or uninstalling the extension. Uninstalling Bookmark Tidy does not reverse bookmark changes that were already applied.

## Security

Bookmark Tidy keeps handled bookmark information within the extension and Chrome's local extension storage. Because the extension does not transmit this information, it does not send bookmark data over a network. Users should still protect access to their device and Chrome profile.

## Limited Use disclosure

Bookmark Tidy's use of information obtained from Chrome APIs is limited to providing and improving its single purpose: helping users safely scan, review, organize, and undo changes to their bookmarks.

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Children's privacy

Bookmark Tidy is a general productivity tool and is not directed to children under 13. The extension does not knowingly collect personal information from children.

## Changes to this policy

This policy may be updated when Bookmark Tidy's functionality or data practices change. The effective date at the top of this page will be revised when an update is published. Material changes will be disclosed as required by applicable Chrome Web Store policies.

## Contact

Questions or concerns about this privacy policy can be submitted through the [Bookmark Tidy GitHub issue tracker](https://github.com/geoffrey-xiao/bookmark-tider/issues).
