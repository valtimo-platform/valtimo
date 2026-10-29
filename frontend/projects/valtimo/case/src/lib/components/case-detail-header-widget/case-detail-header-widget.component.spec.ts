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

import {HttpErrorResponse} from '@angular/common/http';
import {ActivatedRoute} from '@angular/router';
import {PermissionService} from '@valtimo/access-control';
import {CdsThemeService} from '@valtimo/components';
import {SseService} from '@valtimo/sse';
import {firstValueFrom, of, throwError} from 'rxjs';
import {CaseHeaderWidgetApiService} from '../../services';
import {CaseDetailHeaderWidgetComponent} from './case-detail-header-widget.component';

describe('CaseDetailHeaderWidgetComponent', () => {
  let apiService: jasmine.SpyObj<CaseHeaderWidgetApiService>;
  let component: CaseDetailHeaderWidgetComponent;

  beforeEach(() => {
    apiService = jasmine.createSpyObj('CaseHeaderWidgetApiService', [
      'getHeaderWidget',
      'getHeaderWidgetData',
    ]);
    component = new CaseDetailHeaderWidgetComponent(
      apiService,
      {params: of({documentId: 'document-id'})} as unknown as ActivatedRoute,
      {} as PermissionService,
      {currentTheme$: of()} as unknown as CdsThemeService,
      {getSseEventObservable: () => of()} as unknown as SseService
    );
  });

  it('emits no header widget when the request fails', async () => {
    apiService.getHeaderWidget.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 404}))
    );

    await expectAsync(firstValueFrom(component.headerWidget$)).toBeResolvedTo(null);
    expect(apiService.getHeaderWidgetData).not.toHaveBeenCalled();
  });
});
