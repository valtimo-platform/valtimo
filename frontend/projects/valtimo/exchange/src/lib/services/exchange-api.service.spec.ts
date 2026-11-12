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
import {ExchangeApiService} from './exchange-api.service';

describe('ExchangeApiService', () => {
  let http: jasmine.SpyObj<any>;
  let service: ExchangeApiService;

  beforeEach(() => {
    http = jasmine.createSpyObj('HttpClient', ['get']);
    const config = {config: {valtimoApi: {endpointUri: '/api/'}}} as any;
    service = new ExchangeApiService(config, http);
  });

  const lastUrl = (): string => http.get.calls.mostRecent().args[0];

  it('requests the configuration', done => {
    http.get.and.returnValue(of({enabled: true, url: 'https://x'}));

    service.getConfiguration().subscribe(configuration => {
      expect(configuration.enabled).toBeTrue();
      expect(lastUrl()).toContain('v1/exchange/configuration');
      done();
    });
  });

  it('encodes ids when requesting an artifact', () => {
    http.get.and.returnValue(of({}));

    service.getArtifact('a/b', 'c d').subscribe();

    expect(lastUrl()).toContain('publications/a%2Fb/artifacts/c%20d');
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

  describe('buildingBlockInstalled', () => {
    it('checks the specific version when a version tag is given', done => {
      http.get.and.returnValue(of({}));

      service.buildingBlockInstalled('my key', '1.0.0').subscribe(installed => {
        expect(installed).toBeTrue();
        expect(lastUrl()).toContain('building-block/my%20key/version/1.0.0');
        done();
      });
    });

    it('maps a failed version lookup to not installed', done => {
      http.get.and.returnValue(throwError(() => new HttpErrorResponse({status: 404})));

      service.buildingBlockInstalled('key', '1.0.0').subscribe(installed => {
        expect(installed).toBeFalse();
        done();
      });
    });

    it('checks for any version without a version tag', done => {
      http.get.and.returnValue(of({content: [{}]}));

      service.buildingBlockInstalled('key', null).subscribe(installed => {
        expect(installed).toBeTrue();
        done();
      });
    });

    it('reports not installed when no versions exist', done => {
      http.get.and.returnValue(of({content: []}));

      service.buildingBlockInstalled('key', null).subscribe(installed => {
        expect(installed).toBeFalse();
        done();
      });
    });
  });
});
