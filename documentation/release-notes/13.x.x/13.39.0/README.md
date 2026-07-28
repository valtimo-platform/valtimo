# 13.39.0

{% hint style="info" %}
**Release date 29-07-2026**
{% endhint %}

## New Features

* **Skip a waiting timer from the case Progress tab**

  When a process is waiting on a timer, users can now skip that timer directly from the **Progress** tab of a case. A
  skip button appears on the waiting timer in the process diagram; after confirming, the process continues immediately
  as if the timer had elapsed. The option is only available to users who have the `complete` permission on the timer
  (`OperatonTimer`) through Access Control (PBAC), and every skip is recorded in the case's audit trail.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* New bugfix.

## For developers

* A new Access Control resource `com.ritense.valtimo.operaton.domain.OperatonTimer` was added, with the `complete`
  action. Grant `complete` on `OperatonTimer` to a role to expose the skip-timer option on the Progress tab. Timers are
  a resource of their own so that permissions on them stay independent of permissions on the process execution. See
  [Access control - configurable elements](../../../features/access-control/configurable-elements.md).
* A container condition mapper from `OperatonTimer` to `OperatonExecution` is available, so timer permissions can be
  scoped through the execution to the case definition or the case document. See
  [Access control - container conditions](../../../features/access-control/container-conditions.md).
* Two new endpoints were added in the `process-document` module, both requiring the `complete` permission on the timer:
  * `GET /api/v1/process-document/case/{caseId}/process-instance/{processInstanceId}/timers` — lists the active timer
    jobs of a process instance that belongs to the case, restricted to the timers the user may complete.
  * `POST /api/v1/process-document/case/{caseId}/process-instance/{processInstanceId}/timer/{jobId}/skip` — skips
    (fires) the given timer job so the process continues past it.
* Skipping a timer publishes a `ProcessTimerSkippedEvent` audit event, which appears in the case audit trail.
