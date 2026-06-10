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
  save: {};
  tokenRefresh: { accessToken: string };
  themeChanged: { theme: string };
  prefillConfiguration: { title: string; configuration: Record<string, unknown> };
}

/** Events sent from the plugin iframe to the Angular parent. */
interface IframeToParentEvents {
  ready: {};
  resize: { height: number };
  configurationChanged: { valid: boolean; title: string; data: Record<string, unknown> };
  navigate: { route: string };
  notification: { type: "success" | "warning" | "error" | "info"; message: string };
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
  private _parentOrigin: string | null = null;
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

  constructor() {
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

  /** Emit an event to the Angular parent. */
  public emit<E extends IframeEventType>(event: E, payload: IframeToParentEvents[E]): void {
    if (!window.parent || window.parent === window) return;

    window.parent.postMessage(
      { source: "valtimo-plugin", event, payload },
      this._parentOrigin ?? "*"
    );
  }

  /** Convenience: emit configurationChanged with validity, title, and data. */
  public setConfiguration(valid: boolean, title: string, data: Record<string, unknown>): void {
    this.emit("configurationChanged", { valid, title, data });
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
    const m = window.location.pathname.match(/^(\/plugins\/[^/]+\/[^/]+)\//);
    if (!m) return;
    let manifest: { translations?: Record<string, Record<string, string>> } | null = null;
    try {
      const res = await fetch(`${window.location.origin}${m[1]}/plugin-manifest`);
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

    // Store parent origin for targeted postMessage
    if (!this._parentOrigin) {
      this._parentOrigin = event.origin;
    }

    const eventType = data.event as ParentEventType;
    const payload = data.payload;

    // Handle built-in state updates
    if (eventType === "init") {
      const initPayload = payload as ParentToIframeEvents["init"];
      this._accessToken = initPayload.accessToken;
      this._context = initPayload.context;
      this._theme = initPayload.theme;
      this._locale = initPayload.locale;
      this._applyLocale();
      this._resolveInit();
    } else if (eventType === "tokenRefresh") {
      this._accessToken = (payload as ParentToIframeEvents["tokenRefresh"]).accessToken;
    } else if (eventType === "themeChanged") {
      this._theme = (payload as ParentToIframeEvents["themeChanged"]).theme;
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
