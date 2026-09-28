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
import type { HostLogger } from "../models/index.js";

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
 *
 * This address envelope is a safety floor, not the permission mechanism: which *origins* a plugin
 * may call is decided by the per-configuration egress allowlist (see `security/egress-allowlist.ts`).
 * An operator who genuinely needs a plugin to reach an in-cluster service carves the specific range
 * out with `HOST_ALLOWED_INTERNAL_CIDRS` (see {@link parseAllowedInternalCidrs}) rather than
 * disabling the guard; because the carve-out is applied inside
 * {@link isPrivateOrReservedAddress} both enforcement points inherit it and the
 * rebinding-proof property survives.
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
// IPv4-translated (RFC 2765 `::ffff:0:a.b.c.d`, normalised to `::ffff:0:7f00:1`). Blocked wholesale:
// the range embeds an arbitrary IPv4 address in its low bits and is unroutable on a modern stack, so
// there is no legitimate destination in it to preserve.
blockedIpv6.addSubnet("::ffff:0:0:0", 96, "ipv6");
// 6to4 (RFC 3056) — embeds an IPv4 address in bits 16-48, e.g. `2002:7f00:1::` is 127.0.0.1.
// Deprecated by RFC 7526; blocked wholesale for the same reason as IPv4-translated.
blockedIpv6.addSubnet("2002::", 16, "ipv6");
// Teredo (RFC 4380) — also carries an IPv4 address, in the low 32 bits.
blockedIpv6.addSubnet("2001::", 32, "ipv6");
// Deprecated site-local (RFC 3879). Still routed by some stacks, and the v6 sibling of RFC1918.
blockedIpv6.addSubnet("fec0::", 10, "ipv6");
// Discard-only prefix (RFC 6666)
blockedIpv6.addSubnet("100::", 64, "ipv6");
// Link-local and unique-local
blockedIpv6.addSubnet("fe80::", 10, "ipv6");
blockedIpv6.addSubnet("fc00::", 7, "ipv6");
// Multicast
blockedIpv6.addSubnet("ff00::", 8, "ipv6");
// NAT64 well-known prefix — embeds an IPv4 address a translator would connect to
blockedIpv6.addSubnet("64:ff9b::", 96, "ipv6");

/**
 * Never carve-out-able, whatever an operator configures. Cloud metadata services live on
 * 169.254.169.254 and hand out instance credentials to anything that can reach them, which makes
 * link-local the single highest-value target behind an SSRF — and no plugin has a legitimate reason
 * to call it. {@link parseAllowedInternalCidrs} refuses overlapping entries up front; this list is
 * the runtime backstop, and also covers the IPv4-mapped forms (`::ffff:169.254.169.254`) that a
 * carve-out expressed in IPv6 could otherwise reach.
 */
const metadataFloor = new BlockList();
metadataFloor.addSubnet("169.254.0.0", 16);

/** Addresses an operator explicitly exempted from the block lists. */
export type AllowedInternalCidrs = BlockList;

/**
 * Judges a *resolved* address (or an IP literal a plugin supplied) against the block lists.
 *
 * `allowedInternal` is the operator's carve-out from {@link parseAllowedInternalCidrs}: addresses in
 * it are treated as reachable even though they fall inside a blocked range. The link-local floor is
 * checked first, so a carve-out can never open cloud metadata.
 */
export function isPrivateOrReservedAddress(
  address: string,
  allowedInternal?: AllowedInternalCidrs
): boolean {
  const family = isIP(address);
  if (family === 0) return true; // not an IP literal — only resolved addresses reach this check
  if (family === 6) {
    if (metadataFloor.check(address, "ipv6")) return true;
    if (allowedInternal?.check(address, "ipv6")) return false;
    // The URL parser normalises `[::ffff:127.0.0.1]` to the hex form `::ffff:7f00:1`, so a
    // dotted-quad check would never fire on anything that came through a URL. Checking the IPv4
    // rules with family "ipv6" catches both forms — node resolves an IPv4-mapped address against
    // IPv4 rules — while leaving a genuinely public mapped address (`::ffff:8.8.8.8`) allowed.
    if (blockedIpv4.check(address, "ipv6")) return true;
    return blockedIpv6.check(address, "ipv6");
  }
  if (metadataFloor.check(address)) return true;
  if (allowedInternal?.check(address)) return false;
  return blockedIpv4.check(address);
}

/**
 * Parses `HOST_ALLOWED_INTERNAL_CIDRS` — a comma-separated list of CIDR ranges the operator declares
 * this host may reach despite them being private, e.g. `10.4.7.12/32,10.4.7.0/24`. Returns undefined
 * when nothing usable was configured, so callers can skip the carve-out entirely.
 *
 * Malformed entries are dropped with a warning rather than failing startup: an unparseable CIDR
 * narrows what the host can reach, so skipping it fails closed. An entry overlapping
 * 169.254.0.0/16 is refused outright — see {@link metadataFloor}.
 *
 * Keep these ranges as narrow as the service allows. In Kubernetes the pod CIDR (`10.42.0.0/16` or
 * similar) reaches *every* pod in the cluster, including GZAC by IP — which also sidesteps the
 * `gzacBaseUrl` origin check, since that compares origin strings and a pod IP won't match. A
 * specific ClusterIP or a /32 is the useful granularity; a NetworkPolicy or an egress proxy is a
 * better place for this policy altogether.
 */
export function parseAllowedInternalCidrs(
  raw: string | undefined,
  logger?: HostLogger
): AllowedInternalCidrs | undefined {
  const entries = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  if (entries.length === 0) return undefined;

  const list = new BlockList();
  let accepted = 0;
  for (const entry of entries) {
    const match = /^(.+)\/(\d{1,3})$/.exec(entry);
    if (!match) {
      logger?.warn(
        { cidr: entry },
        "Ignoring HOST_ALLOWED_INTERNAL_CIDRS entry: expected CIDR notation like 10.4.7.0/24"
      );
      continue;
    }
    const [, network, prefixText] = match;
    const family = isIP(network);
    const prefix = Number(prefixText);
    if (family === 0 || prefix > (family === 6 ? 128 : 32)) {
      logger?.warn(
        { cidr: entry },
        "Ignoring HOST_ALLOWED_INTERNAL_CIDRS entry: not a valid network address and prefix length"
      );
      continue;
    }
    if (overlapsMetadataFloor(network, prefix, family)) {
      logger?.error(
        { cidr: entry },
        "Refusing HOST_ALLOWED_INTERNAL_CIDRS entry: 169.254.0.0/16 hosts cloud metadata services and is never allowlistable"
      );
      continue;
    }
    list.addSubnet(network, prefix, family === 6 ? "ipv6" : "ipv4");
    accepted++;
  }

  if (accepted === 0) return undefined;
  logger?.info(
    { cidrCount: accepted },
    "http_request may reach these operator-declared internal ranges when a plugin's egress allowlist names the target"
  );
  return list;
}

/**
 * True when the candidate range and 169.254.0.0/16 intersect. CIDR ranges are either disjoint or
 * nested, so it is enough to test both containment directions: whether the candidate holds either
 * end of the floor, and whether the floor holds the candidate's own network address.
 */
function overlapsMetadataFloor(network: string, prefix: number, family: number): boolean {
  const candidate = new BlockList();
  candidate.addSubnet(network, prefix, family === 6 ? "ipv6" : "ipv4");
  const candidateFamily = family === 6 ? "ipv6" : "ipv4";
  return (
    candidate.check("169.254.0.0", candidateFamily) ||
    candidate.check("169.254.255.255", candidateFamily) ||
    metadataFloor.check(network, candidateFamily)
  );
}

/**
 * Returns a rejection reason when the URL's host is an IP literal in a private/reserved range,
 * else null. Complements the guarded agent: connections to IP literals skip DNS, so the agent's
 * lookup guard never sees them.
 */
export function findBlockedIpLiteral(
  url: URL,
  allowedInternal?: AllowedInternalCidrs
): string | null {
  // URL.hostname keeps the brackets around IPv6 literals
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 && isPrivateOrReservedAddress(host, allowedInternal)) {
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
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
  allowedInternal?: AllowedInternalCidrs
): void {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const list = addresses as LookupAddress[];
    const blocked = list.find((entry) => isPrivateOrReservedAddress(entry.address, allowedInternal));
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
 * An undici dispatcher that refuses to open sockets towards private/reserved addresses, except for
 * the ranges in `allowedInternal`.
 * Pass it as `dispatcher` on every fetch call (redirect hops included when redirects are
 * followed manually).
 */
export function createGuardedAgent(allowedInternal?: AllowedInternalCidrs): Agent {
  // `connect` options are forwarded to net/tls.connect, which accepts a custom `lookup`;
  // undici's types don't declare it, hence the cast.
  const lookupWithCarveOut: typeof guardedLookup = (hostname, options, callback) =>
    guardedLookup(hostname, options, callback, allowedInternal);
  return new Agent({ connect: { lookup: lookupWithCarveOut } as object });
}
