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
import {TopbarComponent} from './topbar.component';
import {RouterTestingModule} from '@angular/router/testing';
import {KeycloakService} from 'keycloak-angular';
import {MockIconService, MockKeycloakService, VALTIMO_CONFIG} from '@valtimo/config';
import {environment} from '@src/environments/environment';
import {IconService} from 'carbon-components-angular';

describe('TopbarComponent', () => {
  let component: TopbarComponent;
  let fixture: ComponentFixture<TopbarComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [TopbarComponent],
      imports: [RouterTestingModule],
      providers: [
        {provide: KeycloakService, useClass: MockKeycloakService},
        {provide: VALTIMO_CONFIG, useValue: environment},
        {provide: IconService, useClass: MockIconService},
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TopbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
