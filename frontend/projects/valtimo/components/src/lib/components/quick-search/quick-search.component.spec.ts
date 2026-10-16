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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {TranslateModule} from '@ngx-translate/core';
import {of} from 'rxjs';
import {QUICK_SEARCH_SERVICE} from '../../constants/quick-search.constants';
import {QuickSearchItem} from '../../models';
import {QuickSearchComponent} from './quick-search.component';

describe('QuickSearchComponent', () => {
  const OPEN: QuickSearchItem = {title: 'Open', queryPath: 'status=a', isDefault: false};
  const CLOSED: QuickSearchItem = {title: 'Closed', queryPath: 'status=b', isDefault: true};

  let fixture: ComponentFixture<QuickSearchComponent>;
  let quickSearchService: jasmine.SpyObj<any>;

  const render = (canSetDefault: boolean): void => {
    fixture = TestBed.createComponent(QuickSearchComponent);
    fixture.componentRef.setInput('canSetDefault', canSetDefault);
    fixture.detectChanges();
  };

  const tag = (title: string): HTMLElement =>
    Array.from(fixture.nativeElement.querySelectorAll('cds-tag') as NodeListOf<HTMLElement>).find(
      element => element.textContent?.trim() === title
    )!;

  const openMenu = (title: string): string[] => {
    tag(title).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true}));
    fixture.detectChanges();
    return menuOptions().map(option => option.textContent?.trim() ?? '');
  };

  const menuOptions = (): HTMLElement[] =>
    Array.from(document.querySelectorAll('.cdk-overlay-container v-overflow-menu-option'));

  const menuOption = (text: string): HTMLElement =>
    menuOptions().find(option => option.textContent?.trim() === text)!;

  beforeEach(() => {
    quickSearchService = jasmine.createSpyObj('QuickSearchService', [
      'getQuickSearchItems',
      'deleteQuickSearchItem',
      'setDefaultQuickSearchItem',
      'clearDefaultQuickSearchItem',
    ]);
    quickSearchService.params$ = of({});
    quickSearchService.getQuickSearchItems.and.returnValue(of([OPEN, CLOSED]));
    quickSearchService.setDefaultQuickSearchItem.and.returnValue(of(undefined));
    quickSearchService.clearDefaultQuickSearchItem.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      imports: [QuickSearchComponent, NoopAnimationsModule, TranslateModule.forRoot()],
      providers: [{provide: QUICK_SEARCH_SERVICE, useValue: quickSearchService}],
    });
  });

  afterEach(() => fixture?.destroy());

  it('offers only Delete and marks nothing when defaults are not switched on', () => {
    render(false);

    expect(fixture.nativeElement.querySelector('[cdsTagIcon]')).toBeNull();
    expect(openMenu(CLOSED.title)).toEqual(['interface.delete']);
  });

  it('offers to set a quick search that is not the default as default', () => {
    render(true);

    expect(openMenu(OPEN.title)).toEqual(['quickSearch.setAsDefault', 'interface.delete']);

    menuOption('quickSearch.setAsDefault').click();

    expect(quickSearchService.setDefaultQuickSearchItem).toHaveBeenCalledWith(OPEN);
    expect(quickSearchService.getQuickSearchItems).toHaveBeenCalledTimes(2);
  });

  it('marks the default quick search and offers to remove it as default', () => {
    render(true);

    expect(tag(CLOSED.title).querySelector('[cdsTagIcon]')).not.toBeNull();
    expect(tag(OPEN.title).querySelector('[cdsTagIcon]')).toBeNull();
    expect(openMenu(CLOSED.title)).toEqual(['quickSearch.removeAsDefault', 'interface.delete']);

    menuOption('quickSearch.removeAsDefault').click();

    expect(quickSearchService.clearDefaultQuickSearchItem).toHaveBeenCalled();
    expect(quickSearchService.getQuickSearchItems).toHaveBeenCalledTimes(2);
  });
});
