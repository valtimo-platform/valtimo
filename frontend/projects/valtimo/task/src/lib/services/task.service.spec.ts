/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TaskService} from './task.service';
import {InterceptorSkip, VALTIMO_CONFIG} from '@valtimo/shared';
import {environment} from '@src/environments/environment';
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';

describe('TaskService', () => {
  let service: TaskService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        TaskService,
        {provide: VALTIMO_CONFIG, useValue: environment},
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(TaskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getTask does not set the interceptor skip header when no status codes are provided', () => {
    service.getTask('task-id').subscribe();

    const req = httpMock.expectOne(request => request.url.endsWith('/v1/task/task-id'));
    expect(req.request.headers.has(InterceptorSkip)).toBeFalse();
    req.flush({});
  });

  it('getTask sets the interceptor skip header for the provided status codes', () => {
    service.getTask('task-id', ['403', '404']).subscribe();

    const req = httpMock.expectOne(request => request.url.endsWith('/v1/task/task-id'));
    expect(req.request.headers.get(InterceptorSkip)).toBe('403,404');
    req.flush({});
  });

  it('getCandidateUsers skips the 403 status so the expected access loss is not toasted', () => {
    service.getCandidateUsers('task-id').subscribe();

    const req = httpMock.expectOne(request => request.url.endsWith('/v2/task/task-id/candidate-user'));
    expect(req.request.headers.get(InterceptorSkip)).toBe('403');
    req.flush([]);
  });

  it('getCandidateTeams skips the 403 status so the expected access loss is not toasted', () => {
    service.getCandidateTeams('task-id').subscribe();

    const req = httpMock.expectOne(request =>
      request.url.endsWith('/v1/task/task-id/candidate-team')
    );
    expect(req.request.headers.get(InterceptorSkip)).toBe('403');
    req.flush({content: []});
  });
});
