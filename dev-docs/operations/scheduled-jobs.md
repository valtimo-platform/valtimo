<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# Scheduled jobs on more than one server

> **Audience:** developers maintaining a Valtimo implementation that runs on more than one server.
> With a single server, nothing on this page changes anything.
>
> No action is needed when you run the default Docker images (`gzac-backend`, `valtimo-backend`)
> from 13.54.0 on: they already enable ShedLock. This page applies when you build your own
> application.

Some scheduled jobs should run on only one server at a time, for example:

- the cleanup of handled Notificaties API notifications
- the audit retention cleanup
- the case migration jobs
- the external plugin discovery

Valtimo uses [ShedLock](https://github.com/lukas-krecan/ShedLock) for this, but ShedLock only takes
effect when the application class declares `@EnableSchedulerLock`. Without it, every server runs
these jobs at the same time and does the same work more than once.

## Enable ShedLock

Add the annotation to the class annotated with `@SpringBootApplication`, if it is not there yet:

```kotlin
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock

@SpringBootApplication
@EnableSchedulerLock(defaultLockAtMostFor = "PT30S")
class Application
```

Valtimo already provides the lock provider and creates the lock table (`shedlock`); no other
configuration or database change is needed.

## Check that it works

Every job that has run with a lock has a row in the `shedlock` table, and `locked_by` shows the
server that ran it last. The Notificaties API cleanup runs every poll interval (one minute by
default), so its row is a quick check:

```sql
SELECT name, locked_by, locked_at, lock_until
FROM shedlock
WHERE name = 'NotificatiesApiInboundEventWorker_runMaintenance';
```

If this row does not appear while Notificaties API processing is enabled, ShedLock is not enabled.
