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

import {Component} from '@angular/core';
import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {Route, Router, Routes} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {routes} from './building-block-management-routing';

@Component({standalone: true, template: ''})
class StubComponent {}

// Only the paths and the redirect are under test, so every route keeps its path and gives up its component and guards.
const withoutComponents = (source: Routes): Routes =>
  source.map(({canActivate, canDeactivate, component, ...route}: Route) => ({
    ...route,
    ...(component ? {component: StubComponent} : {}),
  }));

describe('BuildingBlockManagementRouting', () => {
  const BUILDING_BLOCK_ROUTE = '/building-block-management/building-block/my-block/version/1.0.0';

  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes(withoutComponents(routes))],
    });

    router = TestBed.inject(Router);
  });

  it('opens the general tab for a building block url that names no tab', fakeAsync(() => {
    router.navigateByUrl(BUILDING_BLOCK_ROUTE);
    tick();

    expect(router.url).toBe(`${BUILDING_BLOCK_ROUTE}/general`);
  }));

  it('leaves a building block url that does name a tab alone', fakeAsync(() => {
    router.navigateByUrl(`${BUILDING_BLOCK_ROUTE}/mail-template`);
    tick();

    expect(router.url).toBe(`${BUILDING_BLOCK_ROUTE}/mail-template`);
  }));
});
