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

import {TestBed} from '@angular/core/testing';
import {BuildingBlockVersionDto, Page} from '@valtimo/shared';
import {of} from 'rxjs';
import {BuildingBlockStateService} from './building-block-state.service';
import {ProcessLinkBuildingBlockApiService} from './process-link-building-block-api.service';

describe('BuildingBlockStateService', () => {
  let service: BuildingBlockStateService;
  let apiService: jasmine.SpyObj<ProcessLinkBuildingBlockApiService>;

  const pageOf = (versionTags: Array<string>): Page<BuildingBlockVersionDto> =>
    ({
      content: versionTags.map(versionTag => ({versionTag, final: true})),
    }) as Page<BuildingBlockVersionDto>;

  beforeEach(() => {
    apiService = jasmine.createSpyObj('ProcessLinkBuildingBlockApiService', [
      'getAllVersionsForBuildingBlock',
    ]);

    TestBed.configureTestingModule({
      providers: [
        BuildingBlockStateService,
        {provide: ProcessLinkBuildingBlockApiService, useValue: apiService},
      ],
    });

    service = TestBed.inject(BuildingBlockStateService);
  });

  it('exposes every version the backend returns, not just the first page of five', done => {
    const allVersions = ['2.0.0', '1.10.0', '1.9.0', '1.2.0', '1.1.0', '1.0.0'];
    apiService.getAllVersionsForBuildingBlock.and.returnValue(of(pageOf(allVersions)));

    service.setDefinitionKey('my-block');

    expect(apiService.getAllVersionsForBuildingBlock).toHaveBeenCalledWith('my-block');
    service.versions$.subscribe(versions => {
      expect(versions).toEqual(allVersions);
      done();
    });
  });

  it('clears the versions when the definition key is unset', done => {
    service.setDefinitionKey(null);

    expect(apiService.getAllVersionsForBuildingBlock).not.toHaveBeenCalled();
    service.versions$.subscribe(versions => {
      expect(versions).toEqual([]);
      done();
    });
  });
});
