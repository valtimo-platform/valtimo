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
  rootCauseMessage,
} from "./url-guard";

/**
 * The SSRF guard behind the `http_request` capability (plan §18.6). A plugin supplies the URL, so
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
  ])("rejects %s, which the URL parser normalises to a hex mapped address", (raw) => {
    expect(findBlockedIpLiteral(new URL(raw))).toContain("private or reserved range");
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
