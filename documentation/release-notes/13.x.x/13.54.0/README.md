# 13.54.0

Release date: 11-11-2026

{% hint style="warning" %}
This release contains security fixes. See [Security](#security) for details.
{% endhint %}

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case management | Actions hidden from the start menu stay hidden after creating a new version of the case type or changing the building block version of the action. |
| Dashboard | A long dashboard widget subtitle is now cut off with ellipsis instead of running out of the widget, and the full title and subtitle show on hover. |
| Forms | Disabled fields in forms now show their value in readable text, styled as read-only instead of faded grey. |
| Dashboard | A bar chart widget with many categories no longer overflows its widget and overlaps other widgets. The legend now scrolls inside the widget. |

---

## Security

| Severity | Fix |
|----------|-----|
| High | A file attached to a case can now only be opened by users who are allowed to view that case, and can only be removed from within the case. A file that is not yet attached to a case can only be opened or removed by the person who uploaded it. |
| High | A user can no longer attach a file that someone else uploaded to a case, either while uploading or through a form. Users can also no longer add a file to Valtimo that they did not upload themselves. |
| High | Files can no longer be opened through the old form file link without logging in. Logged-in users get the same access rules as for other case files, and files can no longer be deleted through this link. This link is deprecated and will be removed in the next major version. |
| Medium | Completing a task can no longer delete files. |
| Low | Details stored with an uploaded file can no longer be read by other users, apart from the link needed to download it. The person who uploads a file is now always recorded correctly. |
| Low | Submitting a task form for a case that the task does not belong to is now rejected before any uploaded files in it are processed. Before, these files could already be stored before the submission was rejected. |

{% hint style="warning" %}
After upgrading:

* Files uploaded before this version that were never attached to a case can only be opened by administrators.
* Anyone who was in the middle of uploading a file during the upgrade has to upload it again.
* In the rare case that one file was attached to more than one case, it stays available in only one of them.
{% endhint %}
