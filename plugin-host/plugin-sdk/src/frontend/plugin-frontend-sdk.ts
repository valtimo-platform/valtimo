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

/**
 * Frontend SDK for Valtimo external plugins.
 *
 * Runs inside an iframe and communicates with the Angular parent via postMessage.
 * Framework-agnostic — works with React, vanilla JS, or any other framework.
 */

// ---- PostMessage event types ----

/** Events sent from the Angular parent to the plugin iframe. */
interface ParentToIframeEvents {
  init: {
    context: PluginContext;
    accessToken: string;
    theme: string;
    locale: string;
  };
  save: Record<string, never>;
  tokenRefresh: { accessToken: string };
  themeChanged: { theme: string };
  prefillConfiguration: { title: string; configuration: Record<string, unknown> };
  /**
   * Reply to a {@link IframeToParentEvents.proxyRequest}. The parent performed the allow-listed
   * call (against GZAC with the downscoped user token, or against the plugin host) and returns the
   * **data only** — never the token. `error` is set when the parent could not perform the call.
   */
  proxyResponse: { correlationId: string; status: number; body?: unknown; error?: string };
  /**
   * Reply to a {@link IframeToParentEvents.submitTask}. The parent submitted the task-form data to
   * GZAC (which completed the task server-side, the standard way). `ok` is true on success; on a
   * validation failure `errors`/`fieldErrors` carry the messages to render on the form.
   */
  submitResult: {
    correlationId: string;
    ok: boolean;
    errors?: string[];
    fieldErrors?: Record<string, string>;
  };
}

/** Events sent from the plugin iframe to the Angular parent. */
interface IframeToParentEvents {
  ready: Record<string, never>;
  resize: { height: number };
  configurationChanged: { valid: boolean; title: string; data: Record<string, unknown> };
  navigate: { route: string };
  notification: { type: "success" | "warning" | "error" | "info"; message: string };
  /**
   * Hand the collected task-form data to the Angular parent, which submits it to GZAC's task-form
   * submission endpoint (as the logged-in user) so GZAC completes the task the standard way — value
   * resolvers, document updates and the `TaskCompleted` event all run server-side. This is the
   * Level 0/1 path: the iframe holds no token and never names the task id. The parent replies with a
   * {@link ParentToIframeEvents.submitResult}. Prefer {@link ValtimoPluginSDK.submitTask}.
   */
  submitTask: { correlationId: string; data: Record<string, unknown> };
  /**
   * Signal that the plugin has *itself* completed the user task (Level 2 — the escape hatch), e.g.
   * after a `handle_request` handler called GZAC's task-complete endpoint under the downscoped user
   * token (`gzacApi.asUser`). The Angular parent reacts by closing the task and refreshing the list;
   * it does **not** complete the task itself. Level 0/1 forms use {@link submitTask} instead.
   */
  taskCompleted: Record<string, never>;
  /**
   * Ask the Angular parent to perform an allow-listed call on the iframe's behalf. The iframe never
   * holds a credential (opaque origin); the parent attaches the downscoped user token for
   * `target: "gzac"`, or forwards to the plugin host for `target: "plugin"`, and replies with a
   * {@link ParentToIframeEvents.proxyResponse}.
   */
  proxyRequest: {
    correlationId: string;
    target: "gzac" | "plugin";
    method: string;
    path: string;
    query?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
  };
}

/** Result of a proxied call: the HTTP status and the response body (data only). */
export interface ProxyResult {
  status: number;
  body: unknown;
}

/**
 * Result of a {@link ValtimoPluginSDK.submitTask} call. `ok` is true when GZAC completed the task;
 * otherwise `errors` (general messages) and `fieldErrors` (field → message) describe the validation
 * failure so the form can render them.
 */
export interface SubmitResult {
  ok: boolean;
  errors?: string[];
  fieldErrors?: Record<string, string>;
}

/** Context information passed to the plugin on init. */
interface PluginContext {
  pluginConfigurationId?: string;
  pluginDefinitionId?: string;
  pluginId?: string;
  [key: string]: unknown;
}

type ParentEventType = keyof ParentToIframeEvents;
type IframeEventType = keyof IframeToParentEvents;

type EventHandler<T> = (payload: T) => void;

/** Options for {@link ValtimoPluginSDK}. */
export interface ValtimoPluginSDKOptions {
  /**
   * Origin of the hosting Valtimo frontend (the Angular parent), e.g.
   * `"https://valtimo.example.com"`. **Recommended for production bundles.** When set:
   *
   * - inbound messages from any other origin are ignored entirely, and
   * - every outgoing message is posted to this origin only (never `"*"`).
   *
   * When omitted (backward-compatible default — required when the same bundle must run under
   * several Valtimo frontends whose origin isn't known at build time), the SDK pins the origin of
   * the first `init` message it receives and ignores other origins from then on. Until that pin is
   * established, only the credential-free handshake events (`ready`, `resize`) are posted to
   * `"*"`; anything that carries data is queued and flushed to the pinned origin after `init`.
   *
   * Note: the iframe itself runs at an opaque origin (sandbox without `allow-same-origin`), but
   * the *parent's* messages still carry the parent's real origin — so pinning works either way.
   */
  parentOrigin?: string;
}

/**
 * Events that may be posted to `"*"` before the parent origin is known: they carry no data an
 * eavesdropping embedder could use, and `ready` is required to bootstrap the init handshake.
 */
const HANDSHAKE_SAFE_EVENTS: ReadonlySet<string> = new Set(["ready", "resize"]);

// ---- SDK class ----

class ValtimoPluginSDK {
  private _accessToken: string | null = null;
  private _context: PluginContext | null = null;
  private _theme: string | null = null;
  private _locale: string | null = null;
  private _translations: Record<string, string> = {};
  private _allTranslations: Record<string, Record<string, string>> | null = null;
  private readonly _handlers = new Map<string, Array<EventHandler<unknown>>>();
  private readonly _bufferedEvents: Array<{ event: string; payload: unknown }> = [];
  // Pending proxied requests, keyed by an incrementing correlation id (a counter is fine in-browser).
  private _correlationCounter = 0;
  private readonly _pendingRequests = new Map<
    string,
    { resolve: (value: ProxyResult) => void; reject: (reason: unknown) => void }
  >();
  // Pending task-form submissions, resolved by the parent's `submitResult`.
  private readonly _pendingSubmits = new Map<
    string,
    { resolve: (value: SubmitResult) => void; reject: (reason: unknown) => void }
  >();
  /**
   * The only origin we exchange messages with. Set from the constructor option, or pinned to the
   * origin of the first validated `init` message. While null, data-bearing emits are queued in
   * {@link _pendingEmits} instead of being posted to `"*"`.
   */
  private _parentOrigin: string | null = null;
  /** True when the origin came from the `parentOrigin` option (never overwritten by messages). */
  private readonly _explicitParentOrigin: boolean;
  // Emits held back until the parent origin is established (see emit()).
  private readonly _pendingEmits: Array<{ event: string; payload: unknown }> = [];
  // Bound once so addEventListener and removeEventListener share the same reference.
  private readonly _boundOnMessage = this._onMessage.bind(this);
  /**
   * Resolves once the plugin manifest has been fetched **and** the parent's `init` message has
   * arrived (or 2 s have passed without init). Translations are picked from the manifest using
   * the locale received via init, so `await sdk.ready()` before rendering UI guarantees
   * `sdk.t(key)` returns the right string for the active locale rather than the `en` fallback.
   */
  private readonly _readyPromise: Promise<void>;
  private _resolveInit: () => void = () => {};
  private readonly _initPromise: Promise<void>;

  constructor(options: ValtimoPluginSDKOptions = {}) {
    this._parentOrigin = options.parentOrigin ?? null;
    this._explicitParentOrigin = options.parentOrigin != null;
    window.addEventListener("message", this._boundOnMessage);
    this._initPromise = new Promise<void>((resolve) => {
      this._resolveInit = resolve;
    });
    // Fall back to whatever locale info is available if the parent never sends init (standalone
    // plugin previews, broken parent integration, etc.) so the iframe still renders.
    const initTimeout = new Promise<void>((resolve) => setTimeout(resolve, 2000));
    this._readyPromise = Promise.all([
      this._loadManifest(),
      Promise.race([this._initPromise, initTimeout]),
    ]).then(() => undefined);
  }

  // ---- Incoming event handlers ----

  /** Register handler for when the parent sends context (on init). */
  public onContext(handler: EventHandler<PluginContext>): void {
    this._on("init", (payload: ParentToIframeEvents["init"]) => {
      handler(payload.context);
    });
  }

  /** Register handler for when the parent triggers save. */
  public onSave(handler: EventHandler<void>): void {
    this._on("save", () => handler());
  }

  /** Register handler for configuration prefill (edit mode). */
  public onPrefillConfiguration(handler: EventHandler<{ title: string; configuration: Record<string, unknown> }>): void {
    this._on("prefillConfiguration", (payload: ParentToIframeEvents["prefillConfiguration"]) => {
      handler({ title: payload.title, configuration: payload.configuration });
    });
  }

  /** Register handler for theme changes. */
  public onThemeChanged(handler: EventHandler<string>): void {
    this._on("themeChanged", (payload: ParentToIframeEvents["themeChanged"]) => {
      handler(payload.theme);
    });
  }

  // ---- Outgoing events ----

  /**
   * Emit an event to the Angular parent.
   *
   * Once the parent origin is established (constructor option or validated `init`), every message
   * is posted to that origin only. Before that, only the credential-free handshake events go to
   * `"*"`; data-bearing events are queued and flushed as soon as `init` pins the origin, so
   * payload data is never broadcast to an unknown embedder.
   */
  public emit<E extends IframeEventType>(event: E, payload: IframeToParentEvents[E]): void {
    if (!window.parent || window.parent === window) return;

    if (this._parentOrigin === null && !HANDSHAKE_SAFE_EVENTS.has(event)) {
      this._pendingEmits.push({ event, payload });
      return;
    }

    window.parent.postMessage(
      { source: "valtimo-plugin", event, payload },
      this._parentOrigin ?? "*"
    );
  }

  /** Sends emits queued before the parent origin was known. Called once `init` pins the origin. */
  private _flushPendingEmits(): void {
    if (this._parentOrigin === null) return;
    const pending = this._pendingEmits.splice(0);
    for (const { event, payload } of pending) {
      this.emit(event as IframeEventType, payload as IframeToParentEvents[IframeEventType]);
    }
  }

  /** Convenience: emit configurationChanged with validity, title, and data. */
  public setConfiguration(valid: boolean, title: string, data: Record<string, unknown>): void {
    this.emit("configurationChanged", { valid, title, data });
  }

  // ---- Parent-proxied data access ----

  /**
   * Read Valtimo (GZAC) data through the Angular parent, scoped to the logged-in user. The iframe
   * never holds a token — the parent attaches the downscoped user token and returns the data only.
   * `path` must be a GZAC API path (e.g. `/api/v1/document/{id}`).
   *
   * Resolves with `{ status, body }` (the caller decides what to do with a non-2xx status); rejects
   * only when the parent could not perform the call at all.
   */
  public callValtimo(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<ProxyResult> {
    return this._proxyRequest("gzac", method, path, undefined, body, headers);
  }

  /**
   * Fetch data the plugin serves itself (its `handle_request` handler), via the parent → plugin
   * host. `path` is the logical path the handler dispatches on (e.g. `/summary`).
   */
  public getPluginData(path: string, query?: Record<string, string>): Promise<ProxyResult> {
    return this._proxyRequest("plugin", "GET", path, query);
  }

  /**
   * Submit data to the plugin's own `handle_request` handler via the parent → plugin host (the POST
   * counterpart of {@link getPluginData}). Used by a **task-form** bundle to hand its submission to
   * the plugin backend, which then completes the user task with `gzacApi.asUser`. `path` is the
   * logical path the handler dispatches on (e.g. `/submit-task`).
   */
  public postPluginData(path: string, body?: unknown): Promise<ProxyResult> {
    return this._proxyRequest("plugin", "POST", path, undefined, body);
  }

  /**
   * Submit a task-form (Level 0/1). Hands `data` to the Angular parent, which POSTs it to GZAC's
   * task-form submission endpoint under the logged-in user's session; GZAC completes the task the
   * standard way (value resolvers, document updates, `TaskCompleted` event). On success the parent
   * also closes the task and refreshes the list — the plugin does not emit `taskCompleted`.
   *
   * `data` is a flat map; keys may use value-resolver prefixes (`pv:approved`, `doc:/reviewComment`).
   * Unprefixed keys become process variables. Resolves with `{ ok, errors?, fieldErrors? }` — inspect
   * it to render validation errors from a Level 1 `submit` hook without the form being torn down.
   */
  public submitTask(data: Record<string, unknown>): Promise<SubmitResult> {
    const correlationId = String(++this._correlationCounter);
    return new Promise<SubmitResult>((resolve, reject) => {
      this._pendingSubmits.set(correlationId, { resolve, reject });
      this.emit("submitTask", { correlationId, data });
    });
  }

  private _proxyRequest(
    target: "gzac" | "plugin",
    method: string,
    path: string,
    query?: Record<string, string>,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<ProxyResult> {
    const correlationId = String(++this._correlationCounter);
    return new Promise<ProxyResult>((resolve, reject) => {
      this._pendingRequests.set(correlationId, { resolve, reject });
      this.emit("proxyRequest", { correlationId, target, method, path, query, body, headers });
    });
  }

  // ---- Accessors ----

  /** Get the current access token (refreshed automatically). */
  public getAccessToken(): string | null {
    return this._accessToken;
  }

  /** Get the current context. */
  public getContext(): PluginContext | null {
    return this._context;
  }

  /** Get the current theme. */
  public getTheme(): string | null {
    return this._theme;
  }

  /** Get the current locale. */
  public getLocale(): string | null {
    return this._locale;
  }

  /**
   * Resolves once both the parent's init message and the plugin manifest fetch have completed,
   * meaning {@link t} is safe to call. Re-rendering on locale changes is not yet supported.
   */
  public ready(): Promise<void> {
    return this._readyPromise;
  }

  /**
   * Look up a translation by key, with optional fallback. Returns `key` if no translation matches.
   * Use {@link ready} before relying on this in render paths.
   */
  public t(key: string, fallback?: string): string {
    return this._translations[key] ?? fallback ?? key;
  }

  // ---- Internal ----

  /**
   * Fetches the plugin manifest from `{origin}/plugins/{id}/{version}/plugin-manifest`, derived
   * from `window.location`. Waits for the parent's `init` message to learn the locale, then
   * resolves the translation bucket (active locale → `en` fallback → {}).
   */
  private async _loadManifest(): Promise<void> {
    // Build the manifest URL from the full href, NOT window.location.origin: at an opaque origin
    // (the iframe is sandboxed without allow-same-origin) `origin` serialises to "null", while
    // `href` still reflects the document's real URL. This also makes the fetch cross-origin, so the
    // host serves the manifest with `Access-Control-Allow-Origin: *`.
    const base = window.location.href.match(/^(https?:\/\/[^/]+\/plugins\/[^/]+\/[^/]+)\//);
    if (!base) return;
    let manifest: { translations?: Record<string, Record<string, string>> } | null = null;
    try {
      const res = await fetch(`${base[1]}/plugin-manifest`);
      if (res.ok) manifest = await res.json();
    } catch {
      // Network failure: leave translations empty, t() returns the key.
    }
    this._allTranslations = manifest?.translations ?? null;
    this._applyLocale();
  }

  private _applyLocale(): void {
    const all = this._allTranslations;
    if (!all) {
      this._translations = {};
      return;
    }
    const localeBucket = this._locale ? all[this._locale] : undefined;
    this._translations = localeBucket ?? all["en"] ?? {};
  }

  private _on<E extends ParentEventType>(event: E, handler: EventHandler<ParentToIframeEvents[E]>): void {
    const handlers = this._handlers.get(event) ?? [];
    handlers.push(handler as EventHandler<unknown>);
    this._handlers.set(event, handlers);

    // Replay any buffered events that arrived before this handler was registered
    const remaining: Array<{ event: string; payload: unknown }> = [];
    for (const buffered of this._bufferedEvents) {
      if (buffered.event === event) {
        (handler as EventHandler<unknown>)(buffered.payload);
      } else {
        remaining.push(buffered);
      }
    }
    this._bufferedEvents.length = 0;
    this._bufferedEvents.push(...remaining);
  }

  private _onMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data || typeof data !== "object" || data.source !== "valtimo-host") return;

    const eventType = data.event as ParentEventType;

    // Origin filtering: once an origin is established (explicit option, or pinned from the first
    // `init`), messages from any other origin are ignored. Before a pin exists only an `init`
    // message is accepted — it establishes the pin.
    if (this._parentOrigin !== null) {
      if (event.origin !== this._parentOrigin) return;
    } else if (eventType !== "init") {
      return;
    }

    const payload = data.payload;

    // Handle built-in state updates
    if (eventType === "init") {
      if (this._parentOrigin === null) {
        this._parentOrigin = event.origin;
      }
      const initPayload = payload as ParentToIframeEvents["init"];
      this._accessToken = initPayload.accessToken;
      this._context = initPayload.context;
      this._theme = initPayload.theme;
      this._locale = initPayload.locale;
      this._applyLocale();
      this._resolveInit();
      this._flushPendingEmits();
    } else if (eventType === "tokenRefresh") {
      this._accessToken = (payload as ParentToIframeEvents["tokenRefresh"]).accessToken;
    } else if (eventType === "themeChanged") {
      this._theme = (payload as ParentToIframeEvents["themeChanged"]).theme;
    } else if (eventType === "proxyResponse") {
      // Resolve/reject the matching pending request; never dispatched to user handlers.
      const response = payload as ParentToIframeEvents["proxyResponse"];
      const pending = this._pendingRequests.get(response.correlationId);
      if (pending) {
        this._pendingRequests.delete(response.correlationId);
        if (response.error) {
          pending.reject(new Error(response.error));
        } else {
          pending.resolve({ status: response.status, body: response.body });
        }
      }
      return;
    } else if (eventType === "submitResult") {
      // Resolve the matching pending submitTask; never dispatched to user handlers.
      const response = payload as ParentToIframeEvents["submitResult"];
      const pending = this._pendingSubmits.get(response.correlationId);
      if (pending) {
        this._pendingSubmits.delete(response.correlationId);
        pending.resolve({
          ok: response.ok,
          errors: response.errors,
          fieldErrors: response.fieldErrors,
        });
      }
      return;
    }

    // Dispatch to registered handlers, or buffer if none registered yet
    const handlers = this._handlers.get(eventType);
    if (handlers && handlers.length > 0) {
      for (const handler of handlers) {
        handler(payload);
      }
    } else {
      this._bufferedEvents.push({ event: eventType, payload });
    }
  }

  /** Clean up event listener. Call this if you need to destroy the SDK instance. */
  public destroy(): void {
    window.removeEventListener("message", this._boundOnMessage);
  }
}

export {
  ValtimoPluginSDK,
  PluginContext,
  ParentToIframeEvents,
  IframeToParentEvents,
  ParentEventType,
  IframeEventType,
};
// ValtimoPluginSDKOptions is exported inline above.
