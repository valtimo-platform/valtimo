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

import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns";
import type { LookupAddress, LookupOptions } from "node:dns";
import { Agent } from "undici";

/**
 * SSRF guard for the `http_request` host function: plugins supply arbitrary URLs, so without this
 * check a malicious plugin could direct the host to call services that are only reachable from the
 * host's network position — loopback services, the host's own admin API, cloud metadata endpoints
 * (169.254.169.254), or anything on the private LAN.
 *
 * Enforcement happens at connection time: {@link createGuardedAgent} returns an undici dispatcher
 * whose DNS lookup rejects any hostname that resolves to a private/reserved address, so the check
 * is pinned to the exact addresses the socket would connect to. This closes DNS rebinding — there
 * is no separate validate-then-resolve step for a flipping DNS record to exploit — and it covers
 * every request through the agent, including redirect hops. IP-literal hosts bypass DNS entirely,
 * so callers must additionally reject those up front via {@link findBlockedIpLiteral}.
 */

const PRIVATE_ADDRESS_ERROR_CODE = "EPRIVATEADDRESS";

const blockedIpv4 = new BlockList();
// "This network"
blockedIpv4.addSubnet("0.0.0.0", 8);
// RFC1918 private ranges
blockedIpv4.addSubnet("10.0.0.0", 8);
blockedIpv4.addSubnet("172.16.0.0", 12);
blockedIpv4.addSubnet("192.168.0.0", 16);
// Carrier-grade NAT
blockedIpv4.addSubnet("100.64.0.0", 10);
// Loopback
blockedIpv4.addSubnet("127.0.0.0", 8);
// Link-local, incl. cloud metadata services on 169.254.169.254
blockedIpv4.addSubnet("169.254.0.0", 16);
// IETF protocol assignments and benchmarking
blockedIpv4.addSubnet("192.0.0.0", 24);
blockedIpv4.addSubnet("198.18.0.0", 15);
// Multicast, reserved-for-future-use, and broadcast (224.0.0.0–255.255.255.255)
blockedIpv4.addSubnet("224.0.0.0", 3);

const blockedIpv6 = new BlockList();
// Unspecified, loopback, and the whole deprecated IPv4-compatible range (`::a.b.c.d`, RFC 4291
// §2.5.5.1). The WHATWG URL parser normalises such a literal to its hex form (`::7f00:1`), which no
// dotted-quad check would catch, and a dual stack routes it to the embedded IPv4 address.
blockedIpv6.addSubnet("::", 96, "ipv6");
// Link-local and unique-local
blockedIpv6.addSubnet("fe80::", 10, "ipv6");
blockedIpv6.addSubnet("fc00::", 7, "ipv6");
// Multicast
blockedIpv6.addSubnet("ff00::", 8, "ipv6");
// NAT64 well-known prefix — embeds an IPv4 address a translator would connect to
blockedIpv6.addSubnet("64:ff9b::", 96, "ipv6");

export function isPrivateOrReservedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true; // not an IP literal — only resolved addresses reach this check
  if (family === 6) {
    // An IPv4-mapped/compatible IPv6 literal (e.g. ::ffff:127.0.0.1) connects to the embedded
    // IPv4 address, so judge it by its IPv4 rules.
    const embedded = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (embedded) return isPrivateOrReservedAddress(embedded[1]);
    // The dotted form above only appears when a caller hands us the address verbatim; the URL
    // parser normalises `[::ffff:127.0.0.1]` to the hex form `::ffff:7f00:1`. Checking the IPv4
    // rules with family "ipv6" catches both — node resolves an IPv4-mapped address against IPv4
    // rules — while leaving a genuinely public mapped address (`::ffff:8.8.8.8`) allowed.
    if (blockedIpv4.check(address, "ipv6")) return true;
    return blockedIpv6.check(address, "ipv6");
  }
  return blockedIpv4.check(address);
}

/**
 * Returns a rejection reason when the URL's host is an IP literal in a private/reserved range,
 * else null. Complements the guarded agent: connections to IP literals skip DNS, so the agent's
 * lookup guard never sees them.
 */
export function findBlockedIpLiteral(url: URL): string | null {
  // URL.hostname keeps the brackets around IPv6 literals
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 && isPrivateOrReservedAddress(host)) {
    return `IP address ${host} is in a private or reserved range`;
  }
  return null;
}

/** True when `err` (or anything in its `cause` chain) is this guard's private-address rejection. */
export function isPrivateAddressError(err: unknown): boolean {
  for (let e = err; e instanceof Error; e = e.cause) {
    if ((e as NodeJS.ErrnoException).code === PRIVATE_ADDRESS_ERROR_CODE) return true;
  }
  return false;
}

/** The innermost `cause` message — undici wraps connection errors in a generic "fetch failed". */
export function rootCauseMessage(err: unknown): string {
  let current = err;
  while (current instanceof Error && current.cause instanceof Error) {
    current = current.cause;
  }
  return current instanceof Error ? current.message : String(err);
}

/**
 * A DNS lookup for the agent's connector that fails the connection when ANY resolved address is
 * private/reserved (the runtime may pick any of them, and a mixed public/private record set is a
 * classic rebinding trick). Handles both callback shapes `net.connect` uses: single-address, and
 * all-addresses when Happy Eyeballs (`autoSelectFamily`) is active.
 */
function guardedLookup(
  hostname: string,
  options: LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void
): void {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const list = addresses as LookupAddress[];
    const blocked = list.find((entry) => isPrivateOrReservedAddress(entry.address));
    if (list.length === 0 || blocked) {
      const reason = blocked
        ? `Hostname '${hostname}' resolves to ${blocked.address}, which is in a private or reserved range`
        : `Hostname '${hostname}' did not resolve to any address`;
      const error: NodeJS.ErrnoException = new Error(reason);
      error.code = PRIVATE_ADDRESS_ERROR_CODE;
      return callback(error, []);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

/**
 * An undici dispatcher that refuses to open sockets towards private/reserved addresses.
 * Pass it as `dispatcher` on every fetch call (redirect hops included when redirects are
 * followed manually).
 */
export function createGuardedAgent(): Agent {
  // `connect` options are forwarded to net/tls.connect, which accepts a custom `lookup`;
  // undici's types don't declare it, hence the cast.
  return new Agent({ connect: { lookup: guardedLookup } as object });
}
