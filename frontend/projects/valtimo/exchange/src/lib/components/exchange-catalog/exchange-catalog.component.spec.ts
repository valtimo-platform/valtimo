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

import {signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ExchangeCatalogItem, ExchangeCatalogParams} from '../../models';
import {ExchangeCatalogApiService} from '../../services/exchange-catalog-api.service';
import {ExchangeCatalogComponent} from './exchange-catalog.component';
import {ExchangeCatalogService, ExchangeCatalogState} from './exchange-catalog.service';

describe('ExchangeCatalogComponent', () => {
  let fixture: ComponentFixture<ExchangeCatalogComponent>;
  let service: {
    $state: ReturnType<typeof signal<ExchangeCatalogState>>;
    $items: ReturnType<typeof signal<ReadonlyArray<ExchangeCatalogItem>>>;
    $total: ReturnType<typeof signal<number>>;
    $tags: ReturnType<typeof signal<ReadonlyArray<string>>>;
    $runningVersion: ReturnType<typeof signal<string | null>>;
    $params: ReturnType<typeof signal<ExchangeCatalogParams>>;
    init: jasmine.Spy;
    retry: jasmine.Spy;
    clearFilters: jasmine.Spy;
    setTypes: jasmine.Spy;
    setPage: jasmine.Spy;
  };

  const item = (overrides: Partial<ExchangeCatalogItem> = {}): ExchangeCatalogItem => ({
    id: 'p1',
    name: 'Aanvraag energietoeslag',
    shortDescription: 'Short',
    publicationType: 'CaseDefinition',
    tags: ['finance'],
    logo: 'https://assets.example/logo.png',
    publisherOrganization: 'Ritense',
    valtimoVersion: '13.0.0',
    ...overrides,
  });

  const find = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`);

  beforeEach(() => {
    service = {
      $state: signal<ExchangeCatalogState>('ready'),
      $items: signal<ReadonlyArray<ExchangeCatalogItem>>([item()]),
      $total: signal(1),
      $tags: signal<ReadonlyArray<string>>(['finance']),
      $runningVersion: signal<string | null>('13.53.0'),
      $params: signal<ExchangeCatalogParams>({
        q: '',
        types: [],
        tags: [],
        sort: 'nameAsc',
        page: 1,
        size: 20,
      }),
      init: jasmine.createSpy('init'),
      retry: jasmine.createSpy('retry'),
      clearFilters: jasmine.createSpy('clearFilters'),
      setTypes: jasmine.createSpy('setTypes'),
      setPage: jasmine.createSpy('setPage'),
    };

    TestBed.configureTestingModule({
      imports: [ExchangeCatalogComponent, TranslateModule.forRoot()],
      providers: [provideRouter([])],
    });
    TestBed.overrideComponent(ExchangeCatalogComponent, {
      set: {
        providers: [
          {provide: ExchangeCatalogApiService, useValue: {}},
          {provide: ExchangeCatalogService, useValue: service},
        ],
      },
    });
    fixture = TestBed.createComponent(ExchangeCatalogComponent);
  });

  it('renders a tile per item', () => {
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[data-test-id="exchange-catalog-tile"]').length
    ).toBe(1);
  });

  it('shows a launch icon on each tile', () => {
    fixture.detectChanges();

    expect(
      find('exchange-catalog-tile')?.querySelector(
        '[data-test-id="exchange-catalog-tile-launch-icon"]'
      )
    ).not.toBeNull();
  });

  it('translates sort labels once translations load after creation', () => {
    fixture.detectChanges();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      exchange: {catalog: {sort: {nameAsc: 'Name A-Z', recent: 'Most recent'}}},
    });
    translate.use('en');
    fixture.detectChanges();

    const labels = (
      fixture.componentInstance as unknown as {$sortItems: () => Array<{content: string}>}
    )
      .$sortItems()
      .map(sortItem => sortItem.content);
    expect(labels).toEqual(['Name A-Z', 'Most recent']);
  });

  it('links each tile to its detail page so it can open in a new tab', () => {
    fixture.detectChanges();

    expect(find('exchange-catalog-tile')?.getAttribute('href')).toBe('/exchange/p1');
  });

  it('renders skeleton tiles while loading', () => {
    service.$state.set('loading');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[data-test-id="exchange-catalog-skeleton"]').length
    ).toBe(6);
  });

  it('renders the empty state', () => {
    service.$items.set([]);
    fixture.detectChanges();

    expect(find('exchange-catalog-empty')).not.toBeNull();
  });

  it('renders the error state with a working retry', () => {
    service.$state.set('error');
    fixture.detectChanges();

    expect(find('exchange-catalog-error')).not.toBeNull();
    find('exchange-catalog-retry')?.click();
    expect(service.retry).toHaveBeenCalled();
  });

  it('renders the not-configured state', () => {
    service.$state.set('notConfigured');
    fixture.detectChanges();

    expect(find('exchange-catalog-not-configured')).not.toBeNull();
    expect(find('exchange-catalog-tile')).toBeNull();
  });

  it('falls back to the monogram when the logo fails to load', () => {
    fixture.detectChanges();
    expect(find('exchange-catalog-tile-logo')).not.toBeNull();

    find('exchange-catalog-tile-logo')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(find('exchange-catalog-tile-logo')).toBeNull();
    expect(find('exchange-catalog-tile-monogram')?.textContent).toContain('AEN');
  });

  it('shows the newer tag when the item targets a newer Valtimo', () => {
    service.$items.set([item({valtimoVersion: '14.0.0'})]);
    fixture.detectChanges();

    expect(find('exchange-catalog-tile-newer-tag')).not.toBeNull();
  });

  it('shows no newer tag for a compatible item or an unknown running version', () => {
    fixture.detectChanges();
    expect(find('exchange-catalog-tile-newer-tag')).toBeNull();

    service.$items.set([item({valtimoVersion: '14.0.0'})]);
    service.$runningVersion.set(null);
    fixture.detectChanges();
    expect(find('exchange-catalog-tile-newer-tag')).toBeNull();
  });

  it('shows clear filters only when a filter is active', () => {
    fixture.detectChanges();
    expect(find('exchange-catalog-clear-filters')).toBeNull();

    service.$params.set({...service.$params(), types: ['Plugin']});
    fixture.detectChanges();
    expect(find('exchange-catalog-clear-filters')).not.toBeNull();
  });

  it('hides the tag filter without tags', () => {
    service.$tags.set([]);
    fixture.detectChanges();

    expect(find('exchange-catalog-tag-filter')).toBeNull();
  });

  it('shows page navigation only when there is more than one page', () => {
    fixture.detectChanges();
    expect(find('exchange-catalog-pagination')).toBeNull();

    service.$total.set(41);
    fixture.detectChanges();
    expect(
      find('exchange-catalog-pagination')?.querySelectorAll(
        '.cds--pagination-nav__page:not(.cds--pagination-nav__page--direction)'
      ).length
    ).toBe(3);
  });

  it('requests the selected page', () => {
    service.$total.set(41);
    fixture.detectChanges();

    (
      find('exchange-catalog-pagination')?.querySelectorAll(
        '.cds--pagination-nav__page:not(.cds--pagination-nav__page--direction)'
      )[1] as HTMLElement
    ).click();

    expect(service.setPage).toHaveBeenCalledWith(2);
  });
});
