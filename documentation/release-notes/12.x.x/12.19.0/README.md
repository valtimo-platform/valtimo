# 12.19.0

{% hint style="info" %}
#### Release date 28-10-2025
{% endhint %}

## New Features

* **Performance improvements**

Significant performance improvements when retrieving tasks and cases, smaller performance improvements everywhere else.

* **Improved Notificaties API processing**

The Notificaties API plugin now safely stores incoming notifications, prevents duplicates, processes them in the background with automatic retries and clean-up, and offers an admin view for failed messages together with a health check that warns when too many remain. Make sure to add the admin menu entry described [here](https://docs.valtimo.nl/features/plugins/configure-notificaties-api-plugin) so users can reach the new overview.
