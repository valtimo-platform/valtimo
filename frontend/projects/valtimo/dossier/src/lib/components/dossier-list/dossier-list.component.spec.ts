/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {RouterTestingModule} from '@angular/router/testing';
import {DossierListComponent} from './dossier-list.component';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {HttpClient} from '@angular/common/http';
import {MockKeycloakService, MockTranslateService, VALTIMO_CONFIG} from '@valtimo/config';
import {environment} from '@src/environments/environment';
import {TranslateService} from '@ngx-translate/core';
import {LoggerTestingModule} from 'ngx-logger/testing';
import {KeycloakService} from 'keycloak-angular';
import {DatePipe} from '@angular/common';
import {MockProvider} from 'ng-mocks';
import {DossierBulkAssignService} from '../../services';

describe('DossierListComponent', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule, LoggerTestingModule],
      declarations: [DossierListComponent],
      providers: [
        {
          provide: VALTIMO_CONFIG,
          useValue: environment,
        },
        {provide: KeycloakService, useClass: MockKeycloakService},
        {provide: TranslateService, useClass: MockTranslateService},
        MockProvider(DossierBulkAssignService),
        MockProvider(DatePipe),
      ],
    }).compileComponents();

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(DossierListComponent);
    const dossierList = fixture.componentInstance;
    expect(dossierList).toBeTruthy();
  });
});
