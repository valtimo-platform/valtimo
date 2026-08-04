# Backend migration

From this version the Valtimo backend libraries are published to an S3 bucket in addition to
Sonatype Central (Maven Central). Publishing to Sonatype Central stops on **10 August 2026**;
releases published after that date are available only from S3 (versions already on Maven
Central stay there). To keep resolving Valtimo
dependencies, update your Gradle build before then:

{% hint style="warning" %}
The bucket below is being decommissioned. From 13.40.0 the libraries are published to a different
bucket — follow the [13.40.0 backend migration](../13.40.0/back-end-migration.md) instead. 13.39.0
itself also remains available from Maven Central.
{% endhint %}

1. In your `build.gradle.kts`, add the S3 release bucket to the `repositories { }` block:

   ```kotlin
   maven { url = uri("https://valtimo-releases.s3.eu-west-par.io.cloud.ovh.net/") }
   ```

2. Build your project and confirm the Valtimo dependencies still resolve.
3. After 10 August 2026, remove the old `s01.oss.sonatype.org` repositories if you no longer
   need them.

No credentials are required — the libraries are served over plain HTTPS.
