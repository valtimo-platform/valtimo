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

import {createServer, type Server} from "node:http";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {Agent, fetch} from "undici";
import {
  createGuardedAgent,
  findBlockedIpLiteral,
  isPrivateAddressError,
  isPrivateOrReservedAddress,
  parseAllowedInternalCidrs,
  rootCauseMessage,
} from "./url-guard";
import type {HostLogger} from "../models/index.js";

/**
 * The SSRF guard behind the `http_request` capability. A plugin supplies the URL, so
 * these ranges are the boundary between "call a public API" and "make the host read its own
 * network position" — loopback services, the host's admin API, cloud metadata (169.254.169.254).
 */
describe("isPrivateOrReservedAddress", () => {
  it.each([
    ["0.0.0.0", "this network"],
    ["10.1.2.3", "RFC1918 /8"],
    ["172.16.0.1", "RFC1918 /12 lower bound"],
    ["172.31.255.255", "RFC1918 /12 upper bound"],
    ["192.168.1.1", "RFC1918 /16"],
    ["100.64.0.1", "carrier-grade NAT"],
    ["127.0.0.1", "loopback"],
    ["127.255.255.254", "loopback /8 upper range"],
    ["169.254.169.254", "cloud metadata service"],
    ["192.0.0.1", "IETF protocol assignments"],
    ["198.18.0.1", "benchmarking"],
    ["224.0.0.1", "multicast"],
    ["255.255.255.255", "broadcast"],
  ])("blocks %s (%s)", (address) => {
    expect(isPrivateOrReservedAddress(address)).toBe(true);
  });

  it.each([
    ["8.8.8.8", "public resolver"],
    ["1.1.1.1", "public resolver"],
    ["172.32.0.1", "just above the RFC1918 /12 block"],
    ["100.128.0.1", "just above the CGNAT block"],
    ["192.0.1.1", "just above the protocol-assignment /24"],
    ["198.20.0.1", "just above the benchmarking /15"],
    ["223.255.255.255", "just below the multicast /3"],
  ])("allows %s (%s)", (address) => {
    expect(isPrivateOrReservedAddress(address)).toBe(false);
  });

  it.each([
    ["::1", "IPv6 loopback"],
    ["::", "unspecified"],
    ["fe80::1", "link-local"],
    ["fc00::1", "unique-local"],
    ["ff02::1", "multicast"],
    ["64:ff9b::7f00:1", "NAT64 well-known prefix"],
  ])("blocks IPv6 %s (%s)", (address) => {
    expect(isPrivateOrReservedAddress(address)).toBe(true);
  });

  it("allows a public IPv6 address", () => {
    expect(isPrivateOrReservedAddress("2606:4700::1111")).toBe(false);
  });

  it("judges an IPv4-mapped IPv6 literal by its embedded IPv4 address", () => {
    // ::ffff:127.0.0.1 connects to 127.0.0.1 — the v6 block lists alone would not catch it.
    expect(isPrivateOrReservedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedAddress("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it.each([
    ["::ffff:0:7f00:1", "127.0.0.1 IPv4-translated (::ffff:0:a.b.c.d, RFC 2765)"],
    ["2002:7f00:1::", "127.0.0.1 embedded in a 6to4 address (RFC 3056)"],
    ["2002:a9fe:a9fe::", "169.254.169.254 embedded in a 6to4 address"],
    ["2001::1", "Teredo, which also carries an IPv4 address"],
    ["fec0::1", "deprecated site-local — the v6 sibling of RFC1918"],
    ["100::1", "discard-only prefix (RFC 6666)"],
  ])("blocks IPv6 %s (%s)", (address) => {
    // Each of these embeds or reaches an address the IPv4 rules would refuse, or is unroutable —
    // and each bypassed both block lists before they were added.
    expect(isPrivateOrReservedAddress(address)).toBe(true);
  });

  it("still allows a public IPv6 address just outside the Teredo /32", () => {
    // 2001:4860:4860::8888 is Google's public resolver: inside 2001::/16, outside 2001::/32.
    expect(isPrivateOrReservedAddress("2001:4860:4860::8888")).toBe(false);
  });

  it.each([
    ["::ffff:7f00:1", "127.0.0.1 — what the URL parser produces for [::ffff:127.0.0.1]"],
    ["::ffff:a9fe:a9fe", "169.254.169.254, the cloud metadata service"],
    ["::ffff:a00:1", "10.0.0.1"],
    ["::7f00:1", "127.0.0.1 in the deprecated IPv4-compatible form"],
  ])("blocks the hex-normalised mapped address %s (%s)", (address) => {
    // Regression: the WHATWG URL parser rewrites a dotted mapped literal into hex, so a
    // dotted-quad-only check let `https://[::ffff:127.0.0.1]/` through to loopback.
    expect(isPrivateOrReservedAddress(address)).toBe(true);
  });

  it("still allows a public address in hex-normalised mapped form", () => {
    // ::ffff:808:808 is 8.8.8.8 — mapped, but public: the guard must not over-block.
    expect(isPrivateOrReservedAddress("::ffff:808:808")).toBe(false);
  });

  it.each(["example.com", "", "not-an-address"])(
    "fails closed for non-IP input %j (only resolved addresses reach this check)",
    (input) => {
      expect(isPrivateOrReservedAddress(input)).toBe(true);
    }
  );
});

describe("findBlockedIpLiteral", () => {
  it("rejects a private IPv4 literal, naming the address", () => {
    const reason = findBlockedIpLiteral(new URL("http://127.0.0.1:9000/admin"));
    expect(reason).toBe("IP address 127.0.0.1 is in a private or reserved range");
  });

  it("rejects the cloud metadata address", () => {
    expect(findBlockedIpLiteral(new URL("https://169.254.169.254/latest/meta-data/"))).toContain(
      "169.254.169.254"
    );
  });

  it("unwraps the brackets around an IPv6 literal", () => {
    expect(findBlockedIpLiteral(new URL("https://[::1]:8443/x"))).toBe(
      "IP address ::1 is in a private or reserved range"
    );
  });

  it.each([
    "https://[::ffff:127.0.0.1]/admin",
    "https://[::ffff:169.254.169.254]/latest/meta-data/",
    "https://[::127.0.0.1]/admin",
    "https://[::ffff:0:127.0.0.1]/admin",
    "https://[2002:7f00:1::]/admin",
    "https://[fec0::1]/admin",
  ])("rejects %s, which the URL parser normalises to a hex mapped address", (raw) => {
    expect(findBlockedIpLiteral(new URL(raw))).toContain("private or reserved range");
  });

  it.each([
    ["http://127.1/", "127.0.0.1 in short form"],
    ["http://2130706433/", "127.0.0.1 as a decimal integer"],
    ["http://0x7f.0.0.1/", "127.0.0.1 with a hex first octet"],
  ])("rejects %s (%s) — the parser normalises it before isIP sees it", (raw) => {
    expect(findBlockedIpLiteral(new URL(raw))).toContain("127.0.0.1");
  });

  it("passes a public IP literal", () => {
    expect(findBlockedIpLiteral(new URL("https://8.8.8.8/dns-query"))).toBeNull();
  });

  it("passes a DNS hostname — the guarded agent's lookup handles those", () => {
    expect(findBlockedIpLiteral(new URL("https://api.example.com/v1"))).toBeNull();
  });
});

describe("isPrivateAddressError", () => {
  function privateAddressError(): Error {
    const inner: NodeJS.ErrnoException = new Error("resolves to 10.0.0.1");
    inner.code = "EPRIVATEADDRESS";
    return inner;
  }

  it("finds the guard's rejection nested in a cause chain", () => {
    // undici wraps connection errors twice: "fetch failed" → connect error → our lookup error.
    const wrapped = new Error("fetch failed", {
      cause: new Error("connect error", {cause: privateAddressError()}),
    });
    expect(isPrivateAddressError(wrapped)).toBe(true);
  });

  it("recognises the rejection when it is the top-level error", () => {
    expect(isPrivateAddressError(privateAddressError())).toBe(true);
  });

  it("returns false for an unrelated error", () => {
    const other: NodeJS.ErrnoException = new Error("timeout");
    other.code = "UND_ERR_CONNECT_TIMEOUT";
    expect(isPrivateAddressError(new Error("fetch failed", {cause: other}))).toBe(false);
  });

  it("returns false for a non-Error value", () => {
    expect(isPrivateAddressError("EPRIVATEADDRESS")).toBe(false);
    expect(isPrivateAddressError(undefined)).toBe(false);
  });
});

describe("rootCauseMessage", () => {
  it("returns the innermost cause's message", () => {
    const err = new Error("fetch failed", {
      cause: new Error("connect error", {cause: new Error("ECONNREFUSED 1.2.3.4:443")}),
    });
    expect(rootCauseMessage(err)).toBe("ECONNREFUSED 1.2.3.4:443");
  });

  it("returns a bare error's own message", () => {
    expect(rootCauseMessage(new Error("solo"))).toBe("solo");
  });

  it("stringifies a non-Error value", () => {
    expect(rootCauseMessage("plain string")).toBe("plain string");
  });
});

/**
 * The operator layer. `HOST_ALLOWED_INTERNAL_CIDRS` is what lets a plugin reach an in-cluster service
 * without turning the whole guard off, so it has to narrow the block lists precisely — and it must
 * never be able to open cloud metadata, whatever an operator types.
 */
describe("parseAllowedInternalCidrs", () => {
  function recordingLogger(): {logger: HostLogger; messages: string[]} {
    const messages: string[] = [];
    const record = (a: unknown, b?: unknown) =>
      messages.push(typeof a === "string" ? a : String(b ?? ""));
    const logger = {
      info: record,
      warn: record,
      error: record,
      debug: record,
      child: () => logger,
    } as unknown as HostLogger;
    return {logger, messages};
  }

  it("returns undefined when nothing is configured", () => {
    expect(parseAllowedInternalCidrs(undefined)).toBeUndefined();
    expect(parseAllowedInternalCidrs("")).toBeUndefined();
    expect(parseAllowedInternalCidrs("  ,  ")).toBeUndefined();
  });

  it("carves the configured range out of the block lists", () => {
    const allowed = parseAllowedInternalCidrs("10.4.7.0/24");
    expect(isPrivateOrReservedAddress("10.4.7.5", allowed)).toBe(false);
    // Everything outside it stays blocked — the carve-out is a hole, not a switch.
    expect(isPrivateOrReservedAddress("10.4.8.5", allowed)).toBe(true);
    expect(isPrivateOrReservedAddress("127.0.0.1", allowed)).toBe(true);
    expect(isPrivateOrReservedAddress("192.168.1.1", allowed)).toBe(true);
  });

  it("accepts several ranges, in both families", () => {
    const allowed = parseAllowedInternalCidrs("10.4.7.12/32, fd00:dead::/64");
    expect(isPrivateOrReservedAddress("10.4.7.12", allowed)).toBe(false);
    expect(isPrivateOrReservedAddress("10.4.7.13", allowed)).toBe(true);
    expect(isPrivateOrReservedAddress("fd00:dead::5", allowed)).toBe(false);
    expect(isPrivateOrReservedAddress("fd00:beef::5", allowed)).toBe(true);
  });

  it("also carves out the IPv4-mapped form of a carved-out v4 range", () => {
    // A dual stack may hand back ::ffff:10.4.7.5 for the same service.
    const allowed = parseAllowedInternalCidrs("10.4.7.0/24");
    expect(isPrivateOrReservedAddress("::ffff:a04:705", allowed)).toBe(false);
  });

  it("applies through findBlockedIpLiteral, so both enforcement points inherit it", () => {
    const allowed = parseAllowedInternalCidrs("10.4.7.0/24");
    expect(findBlockedIpLiteral(new URL("https://10.4.7.5:8443/api"), allowed)).toBeNull();
    expect(findBlockedIpLiteral(new URL("https://10.4.8.5:8443/api"), allowed)).toContain(
      "private or reserved range"
    );
  });

  it.each([
    ["169.254.0.0/16", "the metadata range itself"],
    ["169.254.169.254/32", "just the metadata address"],
    ["169.0.0.0/8", "a range containing the metadata range"],
    ["0.0.0.0/0", "everything"],
  ])("refuses %s (%s) — cloud metadata is never allowlistable", (cidr) => {
    const {logger, messages} = recordingLogger();
    const allowed = parseAllowedInternalCidrs(cidr, logger);
    expect(allowed).toBeUndefined();
    expect(messages.join(" ")).toContain("169.254.0.0/16");
    expect(isPrivateOrReservedAddress("169.254.169.254", allowed)).toBe(true);
  });

  it("keeps the metadata floor even when a legitimate range is configured alongside a refused one", () => {
    const allowed = parseAllowedInternalCidrs("10.4.7.0/24,169.254.0.0/16");
    expect(isPrivateOrReservedAddress("10.4.7.5", allowed)).toBe(false);
    expect(isPrivateOrReservedAddress("169.254.169.254", allowed)).toBe(true);
    expect(isPrivateOrReservedAddress("::ffff:a9fe:a9fe", allowed)).toBe(true);
  });

  it("refuses a v6 carve-out expressed over the IPv4-mapped metadata range", () => {
    // ::ffff:169.254.0.0/112 is 169.254.0.0/16 written in IPv6. The overlap check has to catch it
    // across families, and the runtime floor covers the mapped form regardless.
    const {logger} = recordingLogger();
    const allowed = parseAllowedInternalCidrs("::ffff:169.254.0.0/112", logger);
    expect(allowed).toBeUndefined();
    expect(isPrivateOrReservedAddress("169.254.169.254", allowed)).toBe(true);
    expect(isPrivateOrReservedAddress("::ffff:a9fe:a9fe", allowed)).toBe(true);
  });

  it("accepts a v6-only range without tripping over the cross-family overlap probe", () => {
    // The overlap check tests a v4 address against the candidate range; with a v6-only entry that
    // has to answer false rather than throw.
    expect(() => parseAllowedInternalCidrs("fd00:dead::/64")).not.toThrow();
    expect(isPrivateOrReservedAddress("fd00:dead::5", parseAllowedInternalCidrs("fd00:dead::/64"))).toBe(
      false
    );
  });

  it.each([
    ["10.4.7.0", "no prefix length"],
    ["not-an-address/24", "not an address"],
    ["10.4.7.0/33", "an out-of-range v4 prefix"],
    ["fd00::/129", "an out-of-range v6 prefix"],
  ])("drops the malformed entry %s (%s) with a warning — dropping fails closed", (cidr) => {
    const {logger, messages} = recordingLogger();
    expect(parseAllowedInternalCidrs(cidr, logger)).toBeUndefined();
    expect(messages.join(" ")).toContain("HOST_ALLOWED_INTERNAL_CIDRS");
  });

  it("keeps the usable entries when only some are malformed", () => {
    const allowed = parseAllowedInternalCidrs("garbage, 10.4.7.0/24");
    expect(isPrivateOrReservedAddress("10.4.7.5", allowed)).toBe(false);
  });
});

/**
 * End-to-end proof that the guard is wired into connection setup rather than merely exported: a
 * real server on 127.0.0.1 reached through the hostname `localhost` (so the connector performs a
 * DNS lookup) must be refused by the guarded agent and reachable through a plain one — which is
 * exactly what `HOST_ALLOW_PRIVATE_NETWORK=true` switches between.
 */
describe("createGuardedAgent", () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, {"content-type": "application/json"});
      res.end('{"ok":true}');
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("no port");
    url = `http://localhost:${address.port}/`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  it("refuses a hostname that resolves to a loopback address", async () => {
    const agent = createGuardedAgent();
    try {
      const err = await fetch(url, {dispatcher: agent}).then(
        () => null,
        (e: unknown) => e
      );
      expect(err).not.toBeNull();
      expect(isPrivateAddressError(err)).toBe(true);
      expect(rootCauseMessage(err)).toContain("private or reserved range");
    } finally {
      await agent.close();
    }
  });

  it("reaches the same server through an unguarded agent (the dev escape hatch)", async () => {
    const agent = new Agent();
    try {
      const res = await fetch(url, {dispatcher: agent});
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ok: true});
    } finally {
      await agent.close();
    }
  });
});
