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
import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {TranslateModule} from '@ngx-translate/core';
import {LoggerTestingModule} from 'ngx-logger/testing';
import {CarbonListModule} from './carbon-list.module';

@Component({
  standalone: false,
  template: `
    <valtimo-carbon-list
      [enableRowMiddleClick]="enableRowMiddleClick"
      [fields]="fields"
      [items]="items"
      (rowClicked)="clicked.push($event)"
    ></valtimo-carbon-list>
  `,
})
class CarbonListHostComponent {
  public enableRowMiddleClick = false;
  public readonly fields = [{key: 'name', label: 'Name'}];
  public readonly items = [{id: 'case-1', name: 'First case'}];
  public readonly clicked: Array<any> = [];
}

describe('CarbonListComponent', () => {
  let fixture: ComponentFixture<CarbonListHostComponent>;
  let host: CarbonListHostComponent;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [CarbonListHostComponent],
      imports: [CarbonListModule, TranslateModule.forRoot(), LoggerTestingModule],
    }).compileComponents();
  }));

  const render = async (enableRowMiddleClick: boolean): Promise<void> => {
    fixture = TestBed.createComponent(CarbonListHostComponent);
    host = fixture.componentInstance;
    host.enableRowMiddleClick = enableRowMiddleClick;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const rowCell = (): HTMLElement => {
    const cell = Array.from(
      fixture.nativeElement.querySelectorAll('tbody td') as NodeListOf<HTMLElement>
    ).find(td => td.textContent.includes('First case'));
    expect(cell).withContext('rendered row cell').toBeTruthy();
    return cell;
  };

  const middleClick = (element: HTMLElement): MouseEvent => {
    const event = new MouseEvent('auxclick', {button: 1, bubbles: true, cancelable: true});
    element.dispatchEvent(event);
    return event;
  };

  it('emits a middle-clicked row as a ctrl click when middle click is enabled', async () => {
    await render(true);

    const event = middleClick(rowCell());

    expect(host.clicked.length).toBe(1);
    expect(host.clicked[0].id).toBe('case-1');
    expect(host.clicked[0].ctrlClick).toBeTrue();
    expect(event.defaultPrevented).toBeTrue();
  });

  it('keeps a plain left click a plain click when middle click is enabled', async () => {
    await render(true);

    rowCell().click();

    expect(host.clicked.length).toBe(1);
    expect(host.clicked[0].ctrlClick).toBeFalse();
  });

  it('ignores a middle click on a row when middle click is not enabled', async () => {
    await render(false);

    const event = middleClick(rowCell());

    expect(host.clicked.length).toBe(0);
    expect(event.defaultPrevented).toBeFalse();
  });

  it('ignores a right click on a row', async () => {
    await render(true);

    rowCell().dispatchEvent(new MouseEvent('auxclick', {button: 2, bubbles: true}));

    expect(host.clicked.length).toBe(0);
  });
});
