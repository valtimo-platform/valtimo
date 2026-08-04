# Backend migration

From this version the Valtimo backend libraries are published to the
`valtimo-release-artifacts` S3 bucket. The bucket used for 13.39.0 is being decommissioned and
does not receive 13.40.0 or later, so replace that repository entry if you added one.

Publishing to Sonatype Central (Maven Central) still stops on **10 August 2026**; releases
published after that date are available only from S3 (versions already on Maven Central stay
there). To keep resolving Valtimo dependencies, update your Gradle build before then:

1. In your `build.gradle.kts`, use the following repository in the `repositories { }` block,
   replacing the 13.39.0 entry if you already added one:

   ```kotlin
   maven { url = uri("https://valtimo-release-artifacts.s3.eu-west-1.amazonaws.com/maven/") }
   ```

2. Build your project and confirm the Valtimo dependencies still resolve.
3. After 10 August 2026, remove the old `s01.oss.sonatype.org` repositories if you no longer
   need them.

No credentials are required — the libraries are served over plain HTTPS.
