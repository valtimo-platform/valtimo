# 12.25.0

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Allow access to Spring Actuator readiness and liveness health endpoints when details are omitted**

  This behaviour, previously limited to `/{base-path}/health`, now also applies to `/{base-path}/health/readiness` and `/{base-path}/health/liveness`. (In Valtimo, `base-path` is usually set to `/management`).
  These endpoints can be used by cloud services to determine whether the application has started successfully and is ready to receive traffic.

## Bugfixes

* New bugfix.
