# Back-end migration

{% hint style="info" %}
This step only matters when your implementation runs on more than one server. With a single
server, skipping it changes nothing.
{% endhint %}

## Run scheduled jobs on one server at a time

Some scheduled jobs must run on only one server at a time, such as the cleanup of handled
Notificaties API notifications, the audit retention cleanup and the case migration jobs. Valtimo
uses ShedLock for this, but ShedLock only takes effect when the application class declares
`@EnableSchedulerLock`. Without it, every server runs these jobs at the same time.

Add the annotation to the class annotated with `@SpringBootApplication`, if it is not there yet:

```kotlin
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock

@SpringBootApplication
@EnableSchedulerLock(defaultLockAtMostFor = "PT30S")
class Application
```

The lock table (`shedlock`) is already created by Valtimo; no database change is needed.
