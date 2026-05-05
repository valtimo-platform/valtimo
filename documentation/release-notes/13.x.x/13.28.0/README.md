# 13.28.0

{% hint style="info" %}
**Release date xx-xx-2026**
{% endhint %}

## Enhancements

* **Opt out of in-pod Liquibase migrations**

  A new `valtimo.liquibase.enabled` property (default `true`) gates Valtimo's `LiquibaseRunner`. Setting it to
  `false` prevents the runner bean from being created so consumers can move migrations out of the application
  pods (for example into a Helm `pre-upgrade` job or an init container). The existing `spring.liquibase.enabled`
  property keeps its meaning of disabling Spring Boot's own `SpringLiquibase` and is unaffected.

## Bugfixes

* **Recovery from stale Liquibase changelog locks**

  In multi-instance deployments a hard-killed migrating JVM (`SIGKILL`, OOMKill, host eviction,
  terminationGrace expiry) could leave `DATABASECHANGELOGLOCK.LOCKED=true` indefinitely, causing every
  subsequent instance to block on `LiquibaseRunner.run()` for the full lock-wait timeout, fail startup,
  and crashloop. `LiquibaseRunner` and `OutboxLiquibaseRunner` now inspect the lock before each migration
  and force-release it when `lockgranted` is older than `valtimo.liquibase.stale-lock-threshold-minutes`
  (default 30); a WARN log identifies the previous holder. The runners also wrap the migration iteration
  in an explicit `try/finally` so a failure mid-iteration cannot leave the lock held, and register a JVM
  shutdown hook scoped to the migration window that releases the lock on graceful `SIGTERM`. Hard kills
  bypass shutdown hooks — those are caught by the threshold-based recovery on the next startup.

  As a side effect, the misleading `Apparent connection leak detected` warning from HikariCP that
  accompanied stuck migrations no longer appears in normal operation, because migrations no longer park
  long enough to trip the leak-detection threshold.
