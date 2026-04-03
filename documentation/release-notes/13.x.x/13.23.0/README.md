# 13.23.0

{% hint style="info" %}
**Release date 08-04-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Security

* **Fixed SpEL injection vulnerability**

  `DocumentMigrationService` and `Condition` evaluated user-supplied SpEL expressions using `StandardEvaluationContext`, which grants unrestricted access to Java types and methods. An authenticated admin could exploit this to execute arbitrary OS commands, exfiltrate environment variables, or load arbitrary classes. Both classes now use `SimpleEvaluationContext`, which only allows property access and blocks type references, method invocation, and constructors.

## Bugfixes

* The case task list now loads significantly faster when building blocks are used.
