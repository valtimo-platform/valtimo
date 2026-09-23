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

import {Injectable, OnDestroy, signal} from '@angular/core';
import {Observable, tap} from 'rxjs';
import {ExternalPluginEndpoint, ExternalPluginUserTokenResponse} from '../models';
import {ExternalPluginUserTokenService} from './external-plugin-user-token.service';

/**
 * Owns the downscoped user-token session for one external-plugin hosting surface (case tab, task
 * form or routed page): it mints the token via the shared {@link ExternalPluginUserTokenService},
 * re-mints it before expiry and retries failed re-mints with capped exponential backoff instead of
 * letting the session die silently with a token about to expire.
 *
 * Deliberately declared `@Injectable()` and NOT `providedIn: 'root'` (page-scoped, per the
 * page-level orchestrator service convention): each hosting surface provides its own instance in
 * its component `providers: []`, so parallel surfaces (e.g. a case tab and a task form open at the
 * same time) never share token state, and teardown of the re-mint timer is tied to the hosting
 * component's lifecycle via {@link ngOnDestroy}.
 */
@Injectable()
export class ExternalPluginSessionService implements OnDestroy {
  /** Re-mint this long before the token expires. */
  private static readonly RE_MINT_MARGIN_MS = 60_000;
  /** Never schedule a re-mint sooner than this (guards against very short/expired TTLs). */
  private static readonly MIN_RE_MINT_DELAY_MS = 30_000;
  /** First retry delay after a failed re-mint; doubles per attempt up to the cap below. */
  private static readonly INITIAL_RETRY_DELAY_MS = 5_000;
  private static readonly MAX_RETRY_DELAY_MS = 60_000;

  private readonly _$userToken = signal<string | null>(null);
  /** Current downscoped user token (null until the first successful mint, and after teardown). */
  public readonly $userToken = this._$userToken.asReadonly();

  private readonly _$expiresAt = signal<string | null>(null);
  /** Expiry (ISO timestamp) of the current token, or null when no token is held. */
  public readonly $expiresAt = this._$expiresAt.asReadonly();

  private readonly _$allowedEndpoints = signal<Array<ExternalPluginEndpoint> | undefined>(undefined);
  /**
   * The granted endpoints of the current session's configuration, as reported by the mint response
   * (audit-C1). Bind this to the iframe's `allowedEndpoints` input: `undefined` until the first
   * successful mint (the iframe skips its precheck, the server-side allowlist stays authoritative);
   * an empty array means the configuration grants nothing and the precheck denies every call.
   */
  public readonly $allowedEndpoints = this._$allowedEndpoints.asReadonly();

  private _configurationId: string | null = null;
  private _reMintHandle: number | null = null;
  private _retryDelayMs = ExternalPluginSessionService.INITIAL_RETRY_DELAY_MS;

  constructor(private readonly userTokenService: ExternalPluginUserTokenService) {}

  public ngOnDestroy(): void {
    this.endSession();
  }

  /**
   * Starts (or restarts) the token session for the given configuration. Returns the observable of
   * the *first* mint so the caller can gate its own ready/error handling on it (e.g. a task form
   * renders anyway when no token can be minted). Subsequent re-mints — and retries of failed
   * re-mints — are handled internally for as long as the session is active.
   */
  public startSession(configurationId: string): Observable<ExternalPluginUserTokenResponse> {
    this.endSession();
    this._configurationId = configurationId;
    return this.userTokenService
      .mintUserToken(configurationId)
      .pipe(tap(token => this._onToken(token)));
  }

  /** Stops re-minting, clears the timer and drops the token. Also called from ngOnDestroy. */
  public endSession(): void {
    this._clearReMint();
    this._configurationId = null;
    this._retryDelayMs = ExternalPluginSessionService.INITIAL_RETRY_DELAY_MS;
    this._$userToken.set(null);
    this._$expiresAt.set(null);
    this._$allowedEndpoints.set(undefined);
  }

  private _onToken(token: ExternalPluginUserTokenResponse): void {
    this._$userToken.set(token.userToken);
    this._$expiresAt.set(token.expiresAt);
    this._$allowedEndpoints.set(token.grantedEndpoints);
    this._retryDelayMs = ExternalPluginSessionService.INITIAL_RETRY_DELAY_MS;
    this._scheduleReMint(token.expiresAt);
  }

  private _scheduleReMint(expiresAt: string): void {
    this._clearReMint();
    const expiry = new Date(expiresAt).getTime();
    const delay = Math.max(
      expiry - Date.now() - ExternalPluginSessionService.RE_MINT_MARGIN_MS,
      ExternalPluginSessionService.MIN_RE_MINT_DELAY_MS
    );
    this._reMintHandle = window.setTimeout(() => this._reMint(), delay);
  }

  private _reMint(): void {
    const configurationId = this._configurationId;
    if (!configurationId) return;

    this.userTokenService.mintUserToken(configurationId).subscribe({
      next: token => this._onToken(token),
      // Retry with capped exponential backoff (5s → 10s → 20s → … ≤ 60s) instead of dying
      // silently: the surface stays open, so keep trying to restore the session. The global
      // HttpErrorInterceptor already surfaces the failed call to the user.
      error: () => this._scheduleRetry(),
    });
  }

  private _scheduleRetry(): void {
    this._clearReMint();
    this._reMintHandle = window.setTimeout(() => this._reMint(), this._retryDelayMs);
    this._retryDelayMs = Math.min(
      this._retryDelayMs * 2,
      ExternalPluginSessionService.MAX_RETRY_DELAY_MS
    );
  }

  private _clearReMint(): void {
    if (this._reMintHandle !== null) {
      window.clearTimeout(this._reMintHandle);
      this._reMintHandle = null;
    }
  }
}
