/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { isEgressAllowed, normalizeEgressEntry } from "@valtimo/plugin-sdk/egress";

/**
 * Origin allowlist for the `http_request` host function, the counterpart to
 * `endpoint-allowlist.ts` for outbound HTTP: `gzac_api` may only call granted GZAC endpoints, and
 * `http_request` may only call granted origins.
 *
 * `http_request` is deny-by-default — an empty (or absent) allowlist makes no outbound calls at all.
 * GZAC pushes the list with the configuration, unioned from the two sources that know a destination:
 * `manifest.permissions.egress` for the fixed targets the plugin author knows at build time, and
 * configuration properties marked `x-egress-target` for the environment-specific ones only the admin
 * knows. The host never learns — or needs — which source an entry came from.
 *
 * This is the *origin* layer. It stops undeclared destinations, and because it runs before any name
 * resolution it also closes DNS-encoded exfiltration: an undeclared hostname never reaches a lookup.
 * On its own it would be vulnerable to DNS rebinding, which is what the address envelope in
 * `url-guard.ts` covers — a declared `sd.internal` that resolves to 169.254.169.254 still dies at
 * connect time. Neither layer is sound alone.
 *
 * Matching rules (scheme + host + port, wildcards, defaults) live in `@valtimo/plugin-sdk/egress`,
 * shared with the manifest validator so an entry that passed review is the entry enforced here.
 */

/**
 * Returns a rejection reason when `url` is not in the configuration's egress allowlist, else null.
 * Shaped like `findBlockedIpLiteral` so `validateTarget` reads as a list of reasons a target is
 * refused.
 */
export function findEgressViolation(url: URL, allowedEgress: string[] | undefined): string | null {
  if (isEgressAllowed(url, allowedEgress)) return null;
  if (allowedEgress === undefined || allowedEgress.length === 0) {
    return (
      `Destination '${url.origin}' is not allowed: this configuration has no egress targets. ` +
      "Declare fixed targets in the plugin manifest's 'permissions.egress', or have the " +
      "administrator supply the URL in a configuration property marked 'x-egress-target'"
    );
  }
  return (
    `Destination '${url.origin}' is not in this configuration's egress allowlist ` +
    `(${describeAllowedEgress(allowedEgress)})`
  );
}

/**
 * The allowlist as a comma-separated list of canonical origins, for error messages and logs. Entries
 * that don't normalise are shown verbatim so a typo in a manifest is visible rather than silently
 * missing from the diagnostic.
 */
export function describeAllowedEgress(allowedEgress: readonly string[]): string {
  return allowedEgress.map((entry) => normalizeEgressEntry(entry) ?? entry).join(", ");
}
