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
import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {SideNavMenu, UIShellModule} from 'carbon-components-angular';
import {By} from '@angular/platform-browser';
import {ExpandOnActiveDirective} from './expand-on-active.directive';

@Component({
  standalone: true,
  imports: [UIShellModule, ExpandOnActiveDirective],
  template: `
    <cds-sidenav-menu title="Cases" [valtimoExpandOnActive]="active">
      <cds-sidenav-item href="javascript:void(0)">Child</cds-sidenav-item>
    </cds-sidenav-menu>
  `,
})
class TestHostComponent {
  public active = false;
}

describe('ExpandOnActiveDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let menu: SideNavMenu;

  const setActive = (active: boolean): void => {
    host.active = active;
    fixture.detectChanges();
    tick();
  };

  const create = (active: boolean): void => {
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    host.active = active;
    fixture.detectChanges();
    tick();
    menu = fixture.debugElement.query(By.directive(SideNavMenu)).injector.get(SideNavMenu);
  };

  beforeEach(() => TestBed.configureTestingModule({imports: [TestHostComponent]}));

  it('expands when the first value is true', fakeAsync(() => {
    create(true);

    expect(menu.expanded).toBeTrue();
  }));

  it('stays collapsed when the first value is false', fakeAsync(() => {
    create(false);

    expect(menu.expanded).toBeFalse();
  }));

  it('re-expands when it becomes active after the user collapsed the menu', fakeAsync(() => {
    create(true);
    menu.toggle();
    expect(menu.expanded).toBeFalse();

    setActive(false);
    setActive(true);

    expect(menu.expanded).toBeTrue();
  }));

  it('never collapses the menu when it becomes inactive', fakeAsync(() => {
    create(true);

    setActive(false);

    expect(menu.expanded).toBeTrue();
  }));

  it('stays expanded when a title click toggles the menu in the same task as the activation', fakeAsync(() => {
    create(false);

    host.active = true;
    fixture.detectChanges();
    menu.toggle();
    tick();

    expect(menu.expanded).toBeTrue();
  }));

  it('keeps the menu collapsed when the user toggles while the input stays true', fakeAsync(() => {
    create(true);
    menu.toggle();

    fixture.detectChanges();
    tick();

    expect(menu.expanded).toBeFalse();
  }));
});
