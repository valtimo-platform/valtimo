const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const payload = btoa(JSON.stringify({
    sub: "user123",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
})).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const signature = crypto.hmac.sha256()
    .withTextSecret(client.global.get("jwtSecret"))
    .updateWithText(`${header}.${payload}`)
    .digest().toBase64Url();

client.global.set("jwt", `${header}.${payload}.${signature}`);