# Whitelisting scripting classes for Camunda

It is possible to use classes in your script tasks by using the script engine. Valtimo restricts the classes that can
be used to the following by default:

```kotlin
"java.util.ArrayList"
"org.joda.time.DateTime"
"java.util.Date"
"java.lang.Math"
"org.camunda.spin.Spin"
"java.time.Clock"
"java.time.Duration"
"java.time.Instant"
"java.time.LocalDate"
"java.time.LocalDateTime"
"java.time.LocalTime"
"java.time.MonthDay"
"java.time.OffsetDateTime"
"java.time.OffsetTime"
"java.time.Period"
"java.time.Year"
"java.time.YearMonth"
"java.time.ZonedDateTime"
"java.time.ZoneId"
"java.time.ZoneOffset"
```

Note: more classes can be whitelisted by using the following Spring property:

#### **`application.yml`**

```yaml
valtimo:
  camunda:
    scripting:
      allowedClasses: java.util.UUID, java.net.URI
```
