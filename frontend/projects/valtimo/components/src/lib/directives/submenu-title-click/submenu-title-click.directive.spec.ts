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
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {SideNavMenu, UIShellModule} from 'carbon-components-angular';

import {LEFT_SIDEBAR_TEST_IDS} from '../../constants/components.test-ids';
import {SubmenuTitleClickDirective} from './submenu-title-click.directive';

@Component({
  standalone: true,
  imports: [UIShellModule, SubmenuTitleClickDirective],
  template: `
    <cds-sidenav-menu
      title="Cases"
      [valtimoSubmenuTitleClick]="enabled"
      (submenuTitleClickEvent)="titleClicks = titleClicks + 1"
    >
      <cds-sidenav-item href="javascript:void(0)">Child</cds-sidenav-item>
    </cds-sidenav-menu>
  `,
})
class TestHostComponent {
  public enabled = true;
  public titleClicks = 0;
}

describe('SubmenuTitleClickDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  const click = (selector: string, detail = 1): void => {
    const element: HTMLElement = fixture.nativeElement.querySelector(selector);
    element.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, detail}));
    fixture.detectChanges();
  };

  const expanded = (): boolean =>
    fixture.debugElement.query(By.directive(SideNavMenu)).componentInstance.expanded;

  beforeEach(() => {
    TestBed.configureTestingModule({imports: [TestHostComponent]});
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits on a title click without expanding the submenu', () => {
    click('.cds--side-nav__submenu-title');

    expect(host.titleClicks).toBe(1);
    expect(expanded()).toBe(false);
  });

  it('does not collapse an open submenu on a title click', () => {
    click('.cds--side-nav__submenu-chevron');
    click('.cds--side-nav__submenu-title');

    expect(host.titleClicks).toBe(1);
    expect(expanded()).toBe(true);
  });

  it('toggles the submenu on a chevron click without emitting', () => {
    click('.cds--side-nav__submenu-chevron');

    expect(host.titleClicks).toBe(0);
    expect(expanded()).toBe(true);
  });

  it('toggles the submenu on a keyboard activation of the title', () => {
    click('.cds--side-nav__submenu-title', 0);

    expect(host.titleClicks).toBe(0);
    expect(expanded()).toBe(true);
  });

  it('marks the chevron with a test id', () => {
    const chevron: HTMLElement = fixture.nativeElement.querySelector(
      '.cds--side-nav__submenu-chevron'
    );

    expect(chevron.getAttribute('data-test-id')).toBe(LEFT_SIDEBAR_TEST_IDS.submenuChevron);
  });

  it('leaves the default toggle intact when disabled', () => {
    host.enabled = false;
    fixture.detectChanges();

    click('.cds--side-nav__submenu-title');

    expect(host.titleClicks).toBe(0);
    expect(expanded()).toBe(true);
  });
});
