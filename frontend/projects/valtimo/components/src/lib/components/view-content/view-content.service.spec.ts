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
import {TestBed} from '@angular/core/testing';
import {TranslateModule} from '@ngx-translate/core';

import {ViewType} from '../../models';
import {ViewContentModule} from './view-content.module';
import {ViewContentService} from './view-content.service';

describe('ViewContentService', () => {
  let service: ViewContentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), ViewContentModule],
    });
    service = TestBed.inject(ViewContentService);
  });

  it('should show a dash for an empty text value', () => {
    expect(service.get('', {key: 'title', viewType: ViewType.TEXT})).toBe('-');
  });

  it('should show nothing for an empty text value when the placeholder is disabled', () => {
    expect(service.get('', {key: 'title', viewType: ViewType.TEXT, emptyPlaceholder: ''})).toBe('');
  });

  it('should not affect a filled text value', () => {
    expect(
      service.get('My divider', {key: 'title', viewType: ViewType.TEXT, emptyPlaceholder: ''})
    ).toBe('My divider');
  });
});
