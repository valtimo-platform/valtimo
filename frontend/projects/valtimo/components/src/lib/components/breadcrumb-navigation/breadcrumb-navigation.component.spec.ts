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

import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {RouterTestingModule} from '@angular/router/testing';
import {BreadcrumbNavigationComponent} from './breadcrumb-navigation.component';
import {MockTranslateService, VALTIMO_CONFIG} from '@valtimo/config';
import {environment} from '@src/environments/environment';
import {HttpClient} from '@angular/common/http';
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {LoggerTestingModule} from 'ngx-logger/testing';
import {DatePipe} from '@angular/common';
import {TranslateService} from '@ngx-translate/core';
import {MockProvider} from 'ng-mocks';
import {KeycloakUserService} from '@valtimo/keycloak';
import {KeycloakService} from 'keycloak-angular';

describe('BreadcrumbNavigationComponent', () => {
  let component: BreadcrumbNavigationComponent;
  let fixture: ComponentFixture<BreadcrumbNavigationComponent>;
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule, LoggerTestingModule],
      declarations: [BreadcrumbNavigationComponent],
      providers: [
        MockProvider(KeycloakService),
        MockProvider(KeycloakUserService),
        {provide: VALTIMO_CONFIG, useValue: environment},
        {provide: TranslateService, useClass: MockTranslateService},
        MockProvider(DatePipe),
      ],
    }).compileComponents();

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BreadcrumbNavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have breadcrumbItems$ property', () => {
    expect(component.breadcrumbItems$).toBeTruthy();
  });
});
