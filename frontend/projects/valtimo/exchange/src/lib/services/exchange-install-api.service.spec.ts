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

import {HttpErrorResponse, HttpHeaders, HttpResponse} from '@angular/common/http';
import {of, throwError} from 'rxjs';
import {ExchangeInstallApiService} from './exchange-install-api.service';

describe('ExchangeInstallApiService', () => {
  let http: jasmine.SpyObj<any>;
  let service: ExchangeInstallApiService;

  beforeEach(() => {
    http = jasmine.createSpyObj('HttpClient', ['get']);
    const config = {config: {valtimoApi: {endpointUri: '/api/'}}} as any;
    service = new ExchangeInstallApiService(config, http);
  });

  const lastUrl = (): string => http.get.calls.mostRecent().args[0];

  it('encodes ids when requesting the content', () => {
    http.get.and.returnValue(of(new HttpResponse({body: new Blob(['zip'])})));

    service.getArtifactContent('a/b', 'c d').subscribe();

    expect(lastUrl()).toContain('publications/a%2Fb/artifacts/c%20d/content');
  });

  describe('getArtifactContent', () => {
    it('uses the file name from Content-Disposition', done => {
      http.get.and.returnValue(
        of(
          new HttpResponse({
            body: new Blob(['zip']),
            headers: new HttpHeaders({'Content-Disposition': 'attachment; filename="plan.zip"'}),
          })
        )
      );

      service.getArtifactContent('p', 'art').subscribe(file => {
        expect(file.name).toBe('plan.zip');
        done();
      });
    });

    it('falls back to the artifact id as file name', done => {
      http.get.and.returnValue(of(new HttpResponse({body: new Blob(['zip'])})));

      service.getArtifactContent('p', 'art').subscribe(file => {
        expect(file.name).toBe('art.zip');
        done();
      });
    });

    it('parses a blob error body into a message', done => {
      http.get.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 413,
              error: new Blob([JSON.stringify({message: 'Too large'})]),
            })
        )
      );

      service.getArtifactContent('p', 'art').subscribe({
        error: (error: HttpErrorResponse) => {
          expect(error.status).toBe(413);
          expect(error.error.message).toBe('Too large');
          done();
        },
      });
    });

    it('rethrows a blob error body that is not JSON with an empty body', done => {
      http.get.and.returnValue(
        throwError(() => new HttpErrorResponse({status: 500, error: new Blob(['oops'])}))
      );

      service.getArtifactContent('p', 'art').subscribe({
        error: (error: HttpErrorResponse) => {
          expect(error.status).toBe(500);
          expect(error.error).toBeNull();
          done();
        },
      });
    });
  });

  describe('buildingBlockStatus', () => {
    it('checks the specific version when a version tag is given', done => {
      http.get.and.returnValue(of({}));

      service.buildingBlockStatus('my key', '1.0.0').subscribe(state => {
        expect(state).toBe('INSTALLED');
        expect(lastUrl()).toContain('building-block/my%20key/version/1.0.0');
        done();
      });
    });

    it('maps a 404 to not installed', done => {
      http.get.and.returnValue(throwError(() => new HttpErrorResponse({status: 404})));

      service.buildingBlockStatus('key', '1.0.0').subscribe(state => {
        expect(state).toBe('NOT_INSTALLED');
        done();
      });
    });

    it('maps other failures to unknown instead of not installed', done => {
      http.get.and.returnValue(throwError(() => new HttpErrorResponse({status: 403})));

      service.buildingBlockStatus('key', '1.0.0').subscribe(state => {
        expect(state).toBe('UNKNOWN');
        done();
      });
    });

    it('checks for any version without a version tag', done => {
      http.get.and.returnValue(of({content: [{}]}));

      service.buildingBlockStatus('key', null).subscribe(state => {
        expect(state).toBe('INSTALLED');
        done();
      });
    });

    it('reports not installed when no versions exist', done => {
      http.get.and.returnValue(of({content: []}));

      service.buildingBlockStatus('key', null).subscribe(state => {
        expect(state).toBe('NOT_INSTALLED');
        done();
      });
    });
  });

  describe('pluginStatus', () => {
    it('reports configured when a configuration exists for the key', done => {
      http.get.and.returnValue(of([{id: 'c1'}]));

      service.pluginStatus('zakenapi').subscribe(state => {
        expect(state).toBe('CONFIGURED');
        expect(lastUrl()).toContain('v1/plugin/configuration');
        expect(http.get.calls.mostRecent().args[1].params).toEqual({
          pluginDefinitionKey: 'zakenapi',
        });
        done();
      });
    });

    it('reports not configured without configurations', done => {
      http.get.and.returnValue(of([]));

      service.pluginStatus('smtp-mail').subscribe(state => {
        expect(state).toBe('NOT_CONFIGURED');
        done();
      });
    });

    it('reports unknown when the lookup fails', done => {
      http.get.and.returnValue(throwError(() => new HttpErrorResponse({status: 500})));

      service.pluginStatus('zakenapi').subscribe(state => {
        expect(state).toBe('UNKNOWN');
        done();
      });
    });
  });
});
