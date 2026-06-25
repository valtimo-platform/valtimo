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

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {TranslateService} from '@ngx-translate/core';
import {ExternalPluginEndpoint} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-external-plugin-iframe',
  templateUrl: './external-plugin-iframe.component.html',
  styleUrls: ['./external-plugin-iframe.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class ExternalPluginIframeComponent implements OnInit, OnDestroy {
  @ViewChild('pluginIframe') public iframeRef!: ElementRef<HTMLIFrameElement>;

  @Input() public bundleUrl!: string;
  @Input() public context: Record<string, unknown> = {};
  @Input() public prefillConfiguration: {
    title: string;
    configuration: Record<string, unknown>;
  } | null = null;
  /**
   * Downscoped user token used **parent-side only** to authorise proxied GZAC reads. It is never
   * sent into the iframe (the iframe is at an opaque origin and holds no credential).
   */
  @Input() public userToken: string | null = null;
  /** `${baseUrl}/${version}/data` — the plugin host route that backs `target: "plugin"` requests. */
  @Input() public pluginDataUrl: string | null = null;
  /** Optional client-side allowlist precheck for GZAC proxy calls (the server is authoritative). */
  @Input() public allowedEndpoints?: ExternalPluginEndpoint[];
  /** External-plugin configuration id, forwarded to the plugin host for `target: "plugin"` calls. */
  @Input() public configurationId: string | null = null;

  @Output() public configurationChangedEvent = new EventEmitter<{
    valid: boolean;
    title: string;
    data: Record<string, unknown>;
  }>();
  @Output() public readyEvent = new EventEmitter<void>();

  public readonly _$trustedUrl = signal<SafeResourceUrl | null>(null);

  private readonly _onMessageBound = this._onMessage.bind(this);

  constructor(
    private readonly _sanitizer: DomSanitizer,
    private readonly _translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    if (this.bundleUrl) {
      this._$trustedUrl.set(this._sanitizer.bypassSecurityTrustResourceUrl(this.bundleUrl));
    }

    window.addEventListener('message', this._onMessageBound);
  }

  public ngOnDestroy(): void {
    window.removeEventListener('message', this._onMessageBound);
  }

  public triggerSave(): void {
    this._postToIframe('save', {});
  }

  public sendPrefillConfiguration(prefill: {
    title: string;
    configuration: Record<string, unknown>;
  }): void {
    this._postToIframe('prefillConfiguration', {
      title: prefill.title,
      configuration: prefill.configuration,
    });
  }

  public onIframeLoad(): void {
    this._postToIframe('init', {
      context: this.context,
      accessToken: '',
      theme: 'white',
      locale: this._translateService.currentLang ?? this._translateService.defaultLang ?? 'en',
    });
  }

  private _postToIframe(event: string, payload: unknown): void {
    const iframe = this.iframeRef?.nativeElement;
    if (!iframe?.contentWindow) return;

    // The iframe is at an opaque origin (sandbox without allow-same-origin), which cannot be
    // addressed by a specific targetOrigin — so we post to '*'. Acceptable because nothing secret
    // (never the token) is ever sent into the iframe.
    iframe.contentWindow.postMessage({source: 'valtimo-host', event, payload}, '*');
  }

  private _onMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data || typeof data !== 'object' || data.source !== 'valtimo-plugin') return;

    // An opaque-origin iframe reports `event.origin === "null"`, so origin-equality can't be used.
    // Validate the message comes from *our* iframe by comparing the source window instead.
    const iframe = this.iframeRef?.nativeElement;
    if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return;

    switch (data.event) {
      case 'ready':
        this.readyEvent.emit();
        if (this.prefillConfiguration) {
          this.sendPrefillConfiguration(this.prefillConfiguration);
        }
        break;
      case 'configurationChanged':
        this.configurationChangedEvent.emit(data.payload);
        break;
      case 'resize':
        this._handleResize(data.payload);
        break;
      case 'proxyRequest':
        void this._handleProxyRequest(data.payload);
        break;
    }
  }

  private _handleResize(payload: {height?: number}): void {
    if (payload.height && this.iframeRef?.nativeElement) {
      this.iframeRef.nativeElement.style.height = `${payload.height}px`;
    }
  }

  /**
   * Performs an allow-listed call on the iframe's behalf and posts the **data only** back as a
   * `proxyResponse`. The downscoped user token is attached parent-side and never enters a
   * postMessage.
   */
  private async _handleProxyRequest(payload: {
    correlationId: string;
    target: 'gzac' | 'plugin';
    method: string;
    path: string;
    query?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<void> {
    const {correlationId, target, method, path, query, body, headers} = payload ?? ({} as never);

    try {
      const result =
        target === 'gzac'
          ? await this._proxyToGzac(method, path, body, headers)
          : await this._proxyToPlugin(method, path, query, body);
      this._postToIframe('proxyResponse', {correlationId, ...result});
    } catch (error) {
      this._postToIframe('proxyResponse', {
        correlationId,
        status: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async _proxyToGzac(
    method: string,
    path: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<{status: number; body: unknown}> {
    if (!this.userToken) {
      throw new Error('No user token available for proxied GZAC call');
    }
    if (this.allowedEndpoints && !this._isAllowed(method, path)) {
      return {status: 403, body: {error: 'Endpoint not allowed for this plugin tab'}};
    }

    const upperMethod = method.toUpperCase();
    const hasBody = body !== undefined && upperMethod !== 'GET' && upperMethod !== 'HEAD';

    // Raw fetch (NOT HttpClient) so the Keycloak bearer interceptor never attaches the full Keycloak
    // token alongside the downscoped one — a confused-deputy guard. `path` is same-origin relative.
    const response = await fetch(path, {
      method: upperMethod,
      headers: {
        ...(headers ?? {}),
        Authorization: `Bearer ${this.userToken}`,
        ...(hasBody ? {'Content-Type': 'application/json'} : {}),
      },
      ...(hasBody ? {body: JSON.stringify(body)} : {}),
    });

    return {status: response.status, body: await this._readBody(response)};
  }

  private async _proxyToPlugin(
    method: string,
    path: string,
    query: Record<string, string> | undefined,
    body: unknown
  ): Promise<{status: number; body: unknown}> {
    if (!this.pluginDataUrl) {
      throw new Error('No plugin data URL configured');
    }

    const response = await fetch(this.pluginDataUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        configurationId: this.configurationId ?? undefined,
        method,
        path,
        query,
        body,
        context: this.context,
        // Forward the downscoped user token so a `handle_request` handler can call GZAC *as the user*
        // (gzacApi.asUser). NOTE: this hands the user token to the plugin host — a deliberate
        // relaxation of the "token never leaves the browser" guarantee, bounded by PBAC ∩ allowlist
        // and the token's short TTL. The plugin only receives data, never the token itself.
        userToken: this.userToken ?? undefined,
      }),
    });

    return {status: response.status, body: await this._readBody(response)};
  }

  private async _readBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private _isAllowed(method: string, path: string): boolean {
    if (!this.allowedEndpoints?.length) return true;
    const pathname = path.split('?')[0];
    return this.allowedEndpoints.some(
      endpoint =>
        endpoint.method.toUpperCase() === method.toUpperCase() &&
        this._matchesPattern(endpoint.pattern, pathname)
    );
  }

  private _matchesPattern(pattern: string, pathname: string): boolean {
    // Translate an Ant-style pattern (`*` single segment, `**` any) to a RegExp. Mirrors the
    // server-side AntPathRequestMatcher closely enough for a client-side precheck.
    const regex = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '§§')
      .replace(/\*/g, '[^/]*')
      .replace(/§§/g, '.*');
    return new RegExp(`^${regex}$`).test(pathname);
  }
}
