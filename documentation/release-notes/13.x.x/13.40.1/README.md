# 13.40.1

{% hint style="info" %}
**Release date 09-09-2026**
{% endhint %}

## Bugfixes

* **A slow IKO server no longer holds up the rest of the application**

  While an IKO screen loaded its widgets, a slow IKO server could hold up unrelated parts of the application. Widget
  data is now fetched without keeping the database busy while waiting for an answer.
