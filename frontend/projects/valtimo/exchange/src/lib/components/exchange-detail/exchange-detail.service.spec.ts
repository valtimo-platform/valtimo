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

import {ActivatedRoute} from '@angular/router';
import {BreadcrumbService, PageTitleService} from '@valtimo/components';
import {ConfigService} from '@valtimo/shared';
import {of, throwError} from 'rxjs';
import {ExchangePublicationDto, ExchangeRequestError} from '../../models';
import {ExchangeCatalogApiService} from '../../services/exchange-catalog-api.service';
import {ExchangeDetailService} from './exchange-detail.service';

describe('ExchangeDetailService', () => {
  let api: jasmine.SpyObj<ExchangeCatalogApiService>;
  let pageTitle: jasmine.SpyObj<PageTitleService>;
  let breadcrumbs: jasmine.SpyObj<BreadcrumbService>;
  let service: ExchangeDetailService;

  const dto = (status: ExchangePublicationDto['status'] = 'PUBLISHED'): ExchangePublicationDto => ({
    id: 'p1',
    name: 'Plan',
    status,
    publicationType: 'CaseDefinition',
    estafetteStage: 'COMMUNITY',
    tags: [],
    screenshots: [],
    artifacts: [],
  });

  const create = (
    configuration: unknown = {enabled: true, url: 'https://x', assetOrigins: []}
  ): void => {
    const route = {snapshot: {paramMap: {get: () => 'p1'}}} as unknown as ActivatedRoute;
    const config = {exchangeConfiguration$: of(configuration)} as unknown as ConfigService;
    service = new ExchangeDetailService(route, api, config, pageTitle, breadcrumbs);
    service.init();
  };

  beforeEach(() => {
    api = jasmine.createSpyObj('ExchangeCatalogApiService', ['getPublication']);
    pageTitle = jasmine.createSpyObj('PageTitleService', ['setCustomPageTitle']);
    breadcrumbs = jasmine.createSpyObj('BreadcrumbService', [
      'setSecondBreadcrumb',
      'clearSecondBreadcrumb',
    ]);
  });

  it('shows a published publication and sets the page title', () => {
    api.getPublication.and.returnValue(of(dto()));
    create();

    expect(service.$state()).toBe('ready');
    expect(pageTitle.setCustomPageTitle).toHaveBeenCalledWith('Plan');
  });

  it('treats a draft as not available', () => {
    api.getPublication.and.returnValue(of(dto('DRAFT')));
    create();

    expect(service.$state()).toBe('notAvailable');
    expect(service.$detail()).toBeNull();
  });

  it('treats a 404 as not available', () => {
    api.getPublication.and.returnValue(throwError(() => new ExchangeRequestError('notFound')));
    create();

    expect(service.$state()).toBe('notAvailable');
  });

  it('shows an error when the Exchange is unreachable and recovers on retry', () => {
    api.getPublication.and.returnValue(throwError(() => new ExchangeRequestError('unavailable')));
    create();
    expect(service.$state()).toBe('error');

    api.getPublication.and.returnValue(of(dto()));
    service.retry();

    expect(service.$state()).toBe('ready');
  });

  it('is not configured without an Exchange configuration', () => {
    create(null);

    expect(service.$state()).toBe('notConfigured');
    expect(api.getPublication).not.toHaveBeenCalled();
  });

  it('sets the Exchange breadcrumb and clears it on destroy', () => {
    api.getPublication.and.returnValue(of(dto()));
    create();

    expect(breadcrumbs.setSecondBreadcrumb).toHaveBeenCalled();
    service.ngOnDestroy();
    expect(breadcrumbs.clearSecondBreadcrumb).toHaveBeenCalled();
  });
});
