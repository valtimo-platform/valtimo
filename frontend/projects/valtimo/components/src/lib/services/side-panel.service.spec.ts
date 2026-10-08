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
import {TestBed} from '@angular/core/testing';
import {firstValueFrom} from 'rxjs';
import {SidePanelOffer} from '../models';
import {SidePanelService} from './side-panel.service';

@Component({standalone: true, template: ''})
class TestContentComponent {}

describe('SidePanelService', () => {
  let service: SidePanelService;

  const offer = (key: string, title = 'Title'): SidePanelOffer => ({
    key,
    title,
    component: TestContentComponent,
  });

  beforeEach(() => {
    localStorage.removeItem('sidePanelWidth');
    TestBed.configureTestingModule({});
    service = TestBed.inject(SidePanelService);
  });

  it('shows an offer', async () => {
    service.offer(offer('a'));

    expect((await firstValueFrom(service.current$))?.key).toBe('a');
    expect(await firstValueFrom(service.visible$)).toBeTrue();
  });

  it('lets a new offer take over and tells the previous provider', () => {
    const first = service.offer(offer('a'));
    const replacedSpy = jasmine.createSpy('replaced');
    first.replaced$.subscribe(replacedSpy);

    service.offer(offer('b'));

    expect(replacedSpy).toHaveBeenCalled();
  });

  it('keeps the handle and shows dismissed content again when the same key is re-offered', async () => {
    const first = service.offer(offer('a'));
    service.dismiss();

    const second = service.offer(offer('a', 'Updated'));

    expect(second).toBe(first);
    expect(await firstValueFrom(service.visible$)).toBeTrue();
    expect((await firstValueFrom(service.current$))?.title).toBe('Updated');
  });

  it('hides on dismiss but keeps the content', async () => {
    const handle = service.offer(offer('a'));
    const dismissedSpy = jasmine.createSpy('dismissed');
    handle.dismissed$.subscribe(dismissedSpy);

    service.dismiss();

    expect(dismissedSpy).toHaveBeenCalled();
    expect(await firstValueFrom(service.visible$)).toBeFalse();
    expect((await firstValueFrom(service.current$))?.key).toBe('a');
  });

  it('ignores a withdraw from a replaced provider', async () => {
    const first = service.offer(offer('a'));
    service.offer(offer('b'));

    first.withdraw();

    expect((await firstValueFrom(service.current$))?.key).toBe('b');
  });

  it('withdraws by key only when that key is current', async () => {
    service.offer(offer('a'));

    service.withdraw('other');
    expect((await firstValueFrom(service.current$))?.key).toBe('a');

    service.withdraw('a');
    expect(await firstValueFrom(service.current$)).toBeNull();
    expect(await firstValueFrom(service.visible$)).toBeFalse();
  });

  it('clamps and persists the width', async () => {
    service.setWidth(10);

    expect(await firstValueFrom(service.width$)).toBe(320);
    expect(localStorage.getItem('sidePanelWidth')).toBe('320');
  });
});
