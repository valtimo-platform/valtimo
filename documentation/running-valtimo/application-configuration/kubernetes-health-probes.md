# Kubernetes health probes

This page describes how to configure Kubernetes liveness, readiness, and startup probes for Valtimo.

## Enabling readiness based on startup completion

By default the application reports itself as ready before startup has fully completed. Follow these steps so
Kubernetes only routes traffic to a pod once it has finished starting up.

1. **Enable the health probes**

   For a custom application, enable the management health probes (also enabled automatically when running in Kubernetes):

   ```yaml
   management:
       endpoint:
           health:
               probes:
                   enabled: true
   ```

2. **Add the `bootstrap` check to the readiness and startup groups**

   For a custom application add:

   ```yaml
   management:
       endpoint:
           health:
               group:
                   readiness:
                       include: readinessState,bootstrap
                   startup:
                       include: readinessState,bootstrap
   ```

3. **Point the Kubernetes probes at the health groups**

   In your deployment (for example your Helm chart), set:

   * `readinessProbe` → `/management/health/readiness`
   * `startupProbe` → `/management/health/startup`

   Leave the `livenessProbe` unchanged.
