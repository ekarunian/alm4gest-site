---
page_id: delete
title: "ALM4GEST data deletion request"
---

Last updated: August 18, 2026

You can ask for data stored on the server for ALM4GEST (the "App") to be deleted.
The App has no account sign-up with an email address or password.
Data on the server is tied to the following identifiers.

| What is stored | Identifier it is tied to | How to delete it in the App |
| --- | --- | --- |
| Friend feature registration (friend code, relationships with other users, records shown to friends) | Friend code | Friends → "Visibility" at the top right → Common → "Stop using friends" |
| Published tier lists | Share code | Tier list → open that list → turn "Publish" off |
| Backup (a full set of the data on your device) | Restore code | By email, as below |
| Play data used to build all-player statistics | Per-game player code (DDR code, SDVX ID, GITADORA ID) | By email, as below |

Data on your device is deleted in full when you uninstall the App.

## Requesting by email

To: [kawaguchi.ek@gmail.com](mailto:kawaguchi.ek@gmail.com)

Subject: ALM4GEST data deletion

Include these two things in the body.

1. What you want deleted (one of the rows above, or "everything")
2. The matching identifier (friend code, share code, restore code, or player code)

You can find these identifiers on the settings screen and the friends screen in the App.
If you can no longer open the App, send whichever identifiers you know.

We delete the data within a reasonable period after receiving your request and reply when it is done.

## What gets deleted

- Data tied to the identifier in your request is deleted from the server.
- Statistics already aggregated so that no individual can be identified (per-chart average scores, clear rates, and similar) cannot be traced back to the original data, so they are not covered.
- Usage information (Google Analytics for Firebase) is not linked to your player code, so we cannot delete it for an individual user. It is deleted automatically once Google's retention period has passed.
- Records that friends imported to their own devices while you were friends remain on those devices.

See the [privacy policy](/en/privacy) for the full details.
