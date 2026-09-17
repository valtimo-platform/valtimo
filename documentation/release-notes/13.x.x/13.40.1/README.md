# 13.40.1

{% hint style="info" %}
**Release date 17-09-2026**
{% endhint %}

## Bugfixes

* **A slow IKO server no longer holds up the rest of the application**

  While an IKO screen loaded its widgets, a slow IKO server could hold up unrelated parts of the application. Widget
  data is now fetched without keeping the database busy while waiting for an answer.


* **Improved the way widgets are displayed when no data could be loaded**
 
  Widgets and search results now show when data could not be retrieved, instead of looking the same as when there is no data.
