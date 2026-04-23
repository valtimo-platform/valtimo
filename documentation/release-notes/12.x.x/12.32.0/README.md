# 12.32.0

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Security

* **Fixed SpEL injection vulnerability**

  `SpelExpressionProcessor`, `SpelExpressionProcessorFactory`, `QueryCondition`, and `DocumentMigrationService` evaluated user-supplied SpEL expressions using `StandardEvaluationContext`, which grants unrestricted access to Java types and methods. An authenticated user could exploit this to execute arbitrary OS commands, exfiltrate environment variables, or load arbitrary classes. These classes now use `SimpleEvaluationContext`, which only allows property access and blocks type references, constructors, and static method invocation.

## Bugfixes

* New bugfix.
