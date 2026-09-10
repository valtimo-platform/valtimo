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

import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {of, throwError} from 'rxjs';
import {ExternalPluginEndpoint, ExternalPluginUserTokenResponse} from '../models';
import {ExternalPluginSessionService} from './external-plugin-session.service';
import {ExternalPluginUserTokenService} from './external-plugin-user-token.service';

describe('ExternalPluginSessionService', () => {
  let service: ExternalPluginSessionService;
  let userTokenServiceSpy: jasmine.SpyObj<ExternalPluginUserTokenService>;

  const grantedEndpoints: Array<ExternalPluginEndpoint> = [
    {method: 'GET', pattern: '/api/v1/documents/**'},
  ];

  const tokenResponse = (
    userToken: string,
    ttlMs: number,
    endpoints: Array<ExternalPluginEndpoint> = grantedEndpoints
  ): ExternalPluginUserTokenResponse => ({
    userToken,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    grantedEndpoints: endpoints,
  });

  beforeEach(() => {
    userTokenServiceSpy = jasmine.createSpyObj<ExternalPluginUserTokenService>(
      'ExternalPluginUserTokenService',
      ['mintUserToken']
    );

    TestBed.configureTestingModule({
      providers: [
        ExternalPluginSessionService,
        {provide: ExternalPluginUserTokenService, useValue: userTokenServiceSpy},
      ],
    });

    service = TestBed.inject(ExternalPluginSessionService);
  });

  afterEach(() => {
    service.endSession();
  });

  it('populates the token, expiry and allowed endpoints after a successful mint', () => {
    userTokenServiceSpy.mintUserToken.and.returnValue(of(tokenResponse('token-1', 300_000)));

    service.startSession('configuration-1').subscribe();

    expect(userTokenServiceSpy.mintUserToken).toHaveBeenCalledWith('configuration-1');
    expect(service.$userToken()).toBe('token-1');
    expect(service.$expiresAt()).not.toBeNull();
    expect(service.$allowedEndpoints()).toEqual(grantedEndpoints);
  });

  it('surfaces an empty granted-endpoint list as an empty array, not undefined', () => {
    // The iframe precheck treats an empty allowlist as deny-all and undefined as "skip the
    // precheck" — collapsing one into the other would silently disable the guard.
    userTokenServiceSpy.mintUserToken.and.returnValue(of(tokenResponse('token-1', 300_000, [])));

    service.startSession('configuration-1').subscribe();

    expect(service.$allowedEndpoints()).toEqual([]);
  });

  it('propagates a first-mint failure to the caller without populating the token', () => {
    userTokenServiceSpy.mintUserToken.and.returnValue(throwError(() => new Error('mint-failed')));
    let failed = false;

    service.startSession('configuration-1').subscribe({error: () => (failed = true)});

    expect(failed).toBeTrue();
    expect(service.$userToken()).toBeNull();
    expect(service.$allowedEndpoints()).toBeUndefined();
  });

  it('re-mints before the token expires', fakeAsync(() => {
    userTokenServiceSpy.mintUserToken.and.returnValues(
      of(tokenResponse('token-1', 300_000)),
      of(tokenResponse('token-2', 300_000))
    );

    service.startSession('configuration-1').subscribe();
    expect(userTokenServiceSpy.mintUserToken).toHaveBeenCalledTimes(1);

    // The re-mint is scheduled at expiry (300s) minus the 60s margin.
    tick(240_000 - 1);
    expect(service.$userToken()).toBe('token-1');

    tick(1);
    expect(userTokenServiceSpy.mintUserToken).toHaveBeenCalledTimes(2);
    expect(service.$userToken()).toBe('token-2');

    service.endSession();
  }));

  it('retries a failed re-mint with backoff instead of dying silently', fakeAsync(() => {
    userTokenServiceSpy.mintUserToken.and.returnValues(
      of(tokenResponse('token-1', 300_000)),
      throwError(() => new Error('mint-failed')),
      throwError(() => new Error('mint-failed')),
      of(tokenResponse('token-2', 300_000))
    );

    service.startSession('configuration-1').subscribe();

    tick(240_000); // scheduled re-mint fires and fails
    expect(userTokenServiceSpy.mintUserToken).toHaveBeenCalledTimes(2);
    expect(service.$userToken()).toBe('token-1'); // keeps the previous token while retrying

    tick(5_000); // first retry (5s backoff) fails again
    expect(userTokenServiceSpy.mintUserToken).toHaveBeenCalledTimes(3);

    tick(10_000); // second retry (10s backoff) succeeds
    expect(userTokenServiceSpy.mintUserToken).toHaveBeenCalledTimes(4);
    expect(service.$userToken()).toBe('token-2');

    service.endSession();
  }));

  it('stops re-minting and clears the token on endSession', fakeAsync(() => {
    userTokenServiceSpy.mintUserToken.and.returnValue(of(tokenResponse('token-1', 300_000)));

    service.startSession('configuration-1').subscribe();
    service.endSession();

    expect(service.$userToken()).toBeNull();
    expect(service.$expiresAt()).toBeNull();
    expect(service.$allowedEndpoints()).toBeUndefined();

    tick(600_000);
    expect(userTokenServiceSpy.mintUserToken).toHaveBeenCalledTimes(1);
  }));
});
