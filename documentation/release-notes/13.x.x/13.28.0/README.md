# 13.28.0

{% hint style="info" %}
**Release date xx-xx-2026**
{% endhint %}

## Enhancements

* **Opt out of in-pod Liquibase migrations**

  New `valtimo.liquibase.enabled` (default `true`); set to `false` to skip Valtimo's in-pod migration.
  `spring.liquibase.enabled` is unchanged.

## Bugfixes

* **Recovery from stale Liquibase changelog locks**

  A hard-killed JVM could leave `DATABASECHANGELOGLOCK` held indefinitely, blocking subsequent instances.
  `LiquibaseRunner` and `OutboxLiquibaseRunner` now force-release stale locks
  (`valtimo.liquibase.stale-lock-threshold-minutes`, default 30) and release on graceful shutdown.
