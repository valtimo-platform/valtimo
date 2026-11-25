/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {ActivatedRoute, Router} from '@angular/router';
import {of} from 'rxjs';
import {TabImpl, TabLoaderImpl} from './tabs.model';

describe('TabLoaderImpl.replaceUrlState', () => {
  const documentId = '754962ac-f87b-4894-8664-451770812df2';
  let navigate: jasmine.Spy;

  const replaceUrlStateAt = (url: string): void => {
    navigate = jasmine.createSpy('navigate');
    const router = {url, navigate} as unknown as Router;
    const route = {
      params: of({documentId}),
      queryParams: of({}),
    } as unknown as ActivatedRoute;

    new TabLoaderImpl([], null, null, router, route).replaceUrlState({
      name: 'progress',
    } as TabImpl);
  };

  it('replaces the tab segment while on the case', () => {
    replaceUrlStateAt(`/cases/verhuizing/document/${documentId}/summary`);

    expect(navigate).toHaveBeenCalledOnceWith(
      [`/cases/verhuizing/document/${documentId}/progress`],
      {replaceUrl: true}
    );
  });

  it('does not navigate once the user left the case', () => {
    replaceUrlStateAt('/cases/verhuizing?assignee=all');

    expect(navigate).not.toHaveBeenCalled();
  });
});
