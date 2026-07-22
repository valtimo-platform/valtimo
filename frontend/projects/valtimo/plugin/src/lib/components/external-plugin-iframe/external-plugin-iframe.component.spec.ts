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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TranslateModule} from '@ngx-translate/core';
import {ConfigService} from '@valtimo/shared';
import {ExternalPluginIframeComponent} from './external-plugin-iframe.component';

describe('ExternalPluginIframeComponent', () => {
  let fixture: ComponentFixture<ExternalPluginIframeComponent>;
  let component: ExternalPluginIframeComponent;

  const configServiceMock = {
    config: {valtimoApi: {endpointUri: '/api/'}},
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ExternalPluginIframeComponent, TranslateModule.forRoot()],
      providers: [{provide: ConfigService, useValue: configServiceMock}],
    });

    fixture = TestBed.createComponent(ExternalPluginIframeComponent);
    component = fixture.componentInstance;
    component.userToken = 'test-user-token';
  });

  const proxyToGzac = (method: string, path: string): Promise<{status: number; body: unknown}> =>
    (component as any)._proxyToGzac(method, path, undefined);

  describe('same-origin enforcement', () => {
    it('rejects an absolute cross-origin URL with a 403 response', async () => {
      const fetchSpy = spyOn(window, 'fetch');

      const result = await proxyToGzac('GET', 'https://evil.example/api/v1/steal');

      expect(result.status).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects a protocol-relative URL with a 403 response', async () => {
      const fetchSpy = spyOn(window, 'fetch');

      const result = await proxyToGzac('GET', '//evil.example/api/v1/steal');

      expect(result.status).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects a javascript: URL with a 403 response', async () => {
      const fetchSpy = spyOn(window, 'fetch');

      const result = await proxyToGzac('GET', 'javascript:alert(1)');

      expect(result.status).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects a malformed URL with a 403 response', async () => {
      const fetchSpy = spyOn(window, 'fetch');

      const result = await proxyToGzac('GET', 'http://');

      expect(result.status).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('API base path enforcement', () => {
    it('rejects a same-origin path outside the API base path', async () => {
      const fetchSpy = spyOn(window, 'fetch');

      const result = await proxyToGzac('GET', '/other/endpoint');

      expect(result.status).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('accepts a valid API path and fetches the normalized same-origin path with the user token', async () => {
      const fetchSpy = spyOn(window, 'fetch').and.resolveTo(
        new Response(JSON.stringify({ok: true}), {status: 200})
      );

      const result = await proxyToGzac('GET', `${window.location.origin}/api/v1/documents?page=1`);

      expect(result.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [requestPath, init] = fetchSpy.calls.mostRecent().args;
      expect(requestPath).toBe('/api/v1/documents?page=1');
      expect((init?.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer test-user-token'
      );
    });
  });

  describe('allowlist precheck', () => {
    let fetchSpy: jasmine.Spy;

    beforeEach(() => {
      fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response('{}', {status: 200}));
    });

    it('skips the precheck when no allowlist input is provided', async () => {
      component.allowedEndpoints = undefined;

      const result = await proxyToGzac('GET', '/api/v1/documents');

      expect(result.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('denies every call when an empty allowlist is provided', async () => {
      component.allowedEndpoints = [];

      const result = await proxyToGzac('GET', '/api/v1/documents');

      expect(result.status).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('allows a call matching a granted endpoint pattern', async () => {
      component.allowedEndpoints = [{method: 'GET', pattern: '/api/v1/documents/**'}];

      const result = await proxyToGzac('GET', '/api/v1/documents/abc/sub');

      expect(result.status).toBe(200);
    });

    it('denies a call whose method does not match the granted endpoint', async () => {
      component.allowedEndpoints = [{method: 'GET', pattern: '/api/v1/documents/**'}];

      const result = await proxyToGzac('POST', '/api/v1/documents/abc');

      expect(result.status).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('treats a single wildcard as one path segment', async () => {
      component.allowedEndpoints = [{method: 'GET', pattern: '/api/v1/documents/*'}];

      expect((await proxyToGzac('GET', '/api/v1/documents/abc')).status).toBe(200);
      expect((await proxyToGzac('GET', '/api/v1/documents/abc/def')).status).toBe(403);
    });
  });

  describe('message filtering', () => {
    let iframe: HTMLIFrameElement;

    beforeEach(() => {
      iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      (component as any).iframeRef = {nativeElement: iframe};
    });

    afterEach(() => {
      iframe.remove();
    });

    const emitMessage = (data: unknown, source: MessageEventSource | null): void =>
      (component as any)._onMessage({data, source} as MessageEvent);

    it('handles a message coming from the iframe contentWindow', () => {
      const readySpy = spyOn(component.readyEvent, 'emit');

      emitMessage({source: 'valtimo-plugin', event: 'ready'}, iframe.contentWindow);

      expect(readySpy).toHaveBeenCalled();
    });

    it('ignores messages whose source is not the iframe contentWindow', () => {
      const readySpy = spyOn(component.readyEvent, 'emit');

      emitMessage({source: 'valtimo-plugin', event: 'ready'}, window);

      expect(readySpy).not.toHaveBeenCalled();
    });

    it('ignores messages without the valtimo-plugin source marker', () => {
      const readySpy = spyOn(component.readyEvent, 'emit');

      emitMessage({source: 'something-else', event: 'ready'}, iframe.contentWindow);

      expect(readySpy).not.toHaveBeenCalled();
    });

    it('posts an init message without any token fields', () => {
      const postMessageSpy = spyOn(iframe.contentWindow as Window, 'postMessage');

      component.onIframeLoad();

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      const message = postMessageSpy.calls.mostRecent().args[0] as {
        event: string;
        payload: Record<string, unknown>;
      };
      expect(message.event).toBe('init');
      expect('accessToken' in message.payload).toBeFalse();
      expect('token' in message.payload).toBeFalse();
      expect('userToken' in message.payload).toBeFalse();
    });
  });

  describe('bundle URL validation', () => {
    afterEach(() => {
      component.ngOnDestroy();
    });

    it('trusts an https bundle URL', () => {
      component.bundleUrl = 'https://plugins.example.com/bundles/tab.html';

      component.ngOnInit();

      expect(component.$trustedUrl()).not.toBeNull();
    });

    it('does not trust a javascript: bundle URL', () => {
      component.bundleUrl = 'javascript:alert(1)';

      component.ngOnInit();

      expect(component.$trustedUrl()).toBeNull();
    });
  });
});
