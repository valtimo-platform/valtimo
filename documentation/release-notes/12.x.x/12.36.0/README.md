# 12.36.0

## Enhancements

* **Improved actuator endpoint security**

  Endpoints added to `management.endpoints.web.exposure.include` are now
  automatically protected — no filter chain override needed.

* **Hardened anonymous health responses**

  Anonymous calls to `/actuator/health` only return the overall status;
  component details require the actuator role. Kubernetes probes and load
  balancers are unaffected.

  {% hint style="warning" %}
  Health groups (e.g. `liveness`, `readiness`) configured with
  `show-details: ALWAYS` previously exposed component details to anonymous
  callers. They are now also reduced to status-only for unauthenticated
  requests. Authenticate with the actuator role to keep seeing details.
  {% endhint %}

* **Dependency upgrades for CVE fixes**

  Upgraded dependency to resolve several CVEs.


