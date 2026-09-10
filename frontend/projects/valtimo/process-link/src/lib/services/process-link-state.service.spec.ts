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
import {take} from 'rxjs/operators';
import {ProcessLinkType} from '../models';
import {BuildingBlockStateService} from './building-block-state.service';
import {PluginStateService} from './plugin-state.service';
import {ProcessLinkButtonService} from './process-link-button.service';
import {ProcessLinkStateService} from './process-link-state.service';
import {ProcessLinkStepService} from './process-link-step.service';

describe('ProcessLinkStateService', () => {
  let service: ProcessLinkStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProcessLinkStateService,
        ProcessLinkButtonService,
        {
          provide: ProcessLinkStepService,
          useValue: jasmine.createSpyObj('ProcessLinkStepService', [
            'setHasOneProcessLinkType',
            'setInitialSteps',
            'setProcessLinkTypeSteps',
            'setContext',
          ]),
        },
        // Only walked when a process link is selected, which these tests never do
        {provide: PluginStateService, useValue: {}},
        {provide: BuildingBlockStateService, useValue: {}},
      ],
    });
    service = TestBed.inject(ProcessLinkStateService);
  });

  // The source is a combineLatest of BehaviorSubjects, so it emits synchronously
  const currentTiles = (): ProcessLinkType[] => {
    let result: ProcessLinkType[] = [];
    service.availableProcessLinkTypes$.pipe(take(1)).subscribe(types => (result = types));
    return result;
  };

  describe('availableProcessLinkTypes$', () => {
    it('enables the Plugins & Apps tile when a hidden external plugin type is enabled', () => {
      // The backend enables 'plugin' for embedded plugin configurations only; an external
      // plugin's task-form reports availability through its own (untiled) type
      service.setAvailableProcessLinkTypes([
        {processLinkType: 'form', enabled: true},
        {processLinkType: 'form-flow', enabled: false},
        {processLinkType: 'plugin', enabled: false},
        {processLinkType: 'url', enabled: true},
        {processLinkType: 'external_plugin_task_form', enabled: true},
        {processLinkType: 'ui-component', enabled: true},
      ]);

      expect(currentTiles()).toEqual([
        {processLinkType: 'form', enabled: true},
        {processLinkType: 'form-flow', enabled: false},
        {processLinkType: 'plugin', enabled: true},
        // Disabled because no FORM_CUSTOM_COMPONENT_TOKEN is provided here
        {processLinkType: 'ui-component', enabled: false},
      ]);
    });

    it('keeps the Plugins & Apps tile disabled when the external plugin types are disabled too', () => {
      service.setAvailableProcessLinkTypes([
        {processLinkType: 'form', enabled: true},
        {processLinkType: 'plugin', enabled: false},
        {processLinkType: 'external_plugin_task_form', enabled: false},
      ]);

      expect(currentTiles()).toEqual([
        {processLinkType: 'form', enabled: true},
        {processLinkType: 'plugin', enabled: false},
      ]);
    });

    it('adds a Plugins & Apps tile when only an external plugin type supports the activity', () => {
      // Without any embedded plugin action for the activity type the backend returns no
      // 'plugin' entry at all, leaving the external types without a tile to surface through
      service.setAvailableProcessLinkTypes([
        {processLinkType: 'form', enabled: true},
        {processLinkType: 'external_plugin', enabled: true},
        {processLinkType: 'ui-component', enabled: true},
      ]);

      expect(currentTiles()).toEqual([
        {processLinkType: 'form', enabled: true},
        {processLinkType: 'plugin', enabled: true},
        {processLinkType: 'ui-component', enabled: false},
      ]);
    });

    it('still disables building-block-unsupported types alongside the external enablement', () => {
      service.setContext('buildingBlock');
      service.setAvailableProcessLinkTypes([
        {processLinkType: 'plugin', enabled: false},
        {processLinkType: 'external_plugin', enabled: true},
        {processLinkType: 'ui-component', enabled: true},
      ]);

      expect(currentTiles()).toEqual([
        {processLinkType: 'plugin', enabled: true},
        {processLinkType: 'ui-component', enabled: false},
      ]);
    });
  });
});
