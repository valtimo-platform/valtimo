# 12.42.0

## New Features

* **Skip a waiting timer from the case Progress tab**

  When a process is waiting on a timer, users can now skip that timer directly from the **Progress** tab of a case. A
  skip button appears on the waiting timer in the process diagram; after confirming, the process continues immediately
  as if the timer had elapsed. The option is only available to users who have the `complete` permission on the timer
  (`CamundaTimer`) through Access Control (PBAC), and every skip is recorded in the case's audit trail.

