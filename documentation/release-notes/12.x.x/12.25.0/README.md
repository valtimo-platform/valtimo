# 12.25.0

## New Features

* **Added delete zaak resultaten action to zaken API plugin**

  The zaken API plugin now includes a new action called 'Delete zaak resultaten'. This action allows users to delete the results of a zaak.

## Enhancements

* **Allow access to Spring Actuator readiness and liveness health endpoints when details are omitted**

  This behaviour, previously limited to `/{base-path}/health`, now also applies to `/{base-path}/health/readiness` and `/{base-path}/health/liveness`. (In Valtimo, `base-path` is usually set to `/management`).
  These endpoints can be used by cloud services to determine whether the application has started successfully and is ready to receive traffic.
