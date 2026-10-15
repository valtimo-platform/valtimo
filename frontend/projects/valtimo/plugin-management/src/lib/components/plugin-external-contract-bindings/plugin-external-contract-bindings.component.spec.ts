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
import {SimpleChange} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {of} from 'rxjs';
import {
  ExternalPluginContractBindingEntry,
  ExternalPluginContractProvider,
  ExternalPluginDefinition,
  ExternalPluginService,
} from '@valtimo/plugin';
import {PluginExternalContractBindingsComponent} from './plugin-external-contract-bindings.component';

describe('PluginExternalContractBindingsComponent', () => {
  let fixture: ComponentFixture<PluginExternalContractBindingsComponent>;
  let component: PluginExternalContractBindingsComponent;
  let externalPluginService: jasmine.SpyObj<ExternalPluginService>;
  let lastBindings: Array<ExternalPluginContractBindingEntry> = [];
  let lastValid: boolean | null = null;

  const provider = (configurationId: string): ExternalPluginContractProvider => ({
    configurationId,
    configurationTitle: `Open Plan ${configurationId}`,
    definitionId: 'definition-id',
    pluginId: 'openplan',
    version: '1.0.0',
    hostId: 'host-id',
    hostName: 'Plugin host',
    hostKind: 'PLUGIN_HOST',
    available: true,
    operations: [{key: 'list', title: 'List', mode: 'sync', timeout: null}],
  });

  const applyContracts = (contracts: Array<string>): void => {
    component.contracts = contracts;
    component.ngOnChanges({contracts: new SimpleChange([], contracts, true)});
  };

  beforeEach(() => {
    externalPluginService = jasmine.createSpyObj<ExternalPluginService>('ExternalPluginService', [
      'getContractProviders',
      'getDefinition',
    ]);
    externalPluginService.getDefinition.and.returnValue(
      of({manifest: {translations: {}}} as unknown as ExternalPluginDefinition)
    );

    TestBed.configureTestingModule({
      imports: [PluginExternalContractBindingsComponent, TranslateModule.forRoot()],
      providers: [{provide: ExternalPluginService, useValue: externalPluginService}],
    });

    fixture = TestBed.createComponent(PluginExternalContractBindingsComponent);
    component = fixture.componentInstance;
    component.bindingsChangeEvent.subscribe(bindings => (lastBindings = bindings));
    component.validEvent.subscribe(valid => (lastValid = valid));
    lastBindings = [];
    lastValid = null;
  });

  it('is valid without declared contracts', () => {
    applyContracts([]);

    expect(externalPluginService.getContractProviders).not.toHaveBeenCalled();
    expect(lastBindings).toEqual([]);
    expect(lastValid).toBeTrue();
  });

  it('pre-selects the only provider — the common case is one click', () => {
    externalPluginService.getContractProviders.and.returnValue(of([provider('a')]));

    applyContracts(['nl.ritense.openplan@1']);

    expect(externalPluginService.getContractProviders).toHaveBeenCalledWith(
      'nl.ritense.openplan@1'
    );
    expect(lastBindings).toEqual([{contract: 'nl.ritense.openplan@1', targetConfigurationId: 'a'}]);
    expect(lastValid).toBeTrue();
  });

  it('blocks submit until the admin chooses between several providers', () => {
    externalPluginService.getContractProviders.and.returnValue(of([provider('a'), provider('b')]));

    applyContracts(['nl.ritense.openplan@1']);

    expect(lastValid).toBeFalse();

    component.onProviderSelected('nl.ritense.openplan@1', {
      item: {content: 'b', selected: true, configurationId: 'b'},
    });

    expect(lastBindings).toEqual([{contract: 'nl.ritense.openplan@1', targetConfigurationId: 'b'}]);
    expect(lastValid).toBeTrue();
  });

  it('stays invalid when nothing provides the contract yet', () => {
    externalPluginService.getContractProviders.and.returnValue(of([]));

    applyContracts(['nl.ritense.openplan@1']);

    expect(component.$rows()[0].items.length).toBe(0);
    expect(lastValid).toBeFalse();
  });

  it('keeps the current binding and never offers the edited configuration itself', () => {
    externalPluginService.getContractProviders.and.returnValue(
      of([provider('self'), provider('a'), provider('b')])
    );
    component.selfConfigurationId = 'self';
    component.currentBindings = [
      {
        contract: 'nl.ritense.openplan@1',
        targetConfigurationId: 'b',
        targetConfigurationTitle: 'B',
      },
    ];

    applyContracts(['nl.ritense.openplan@1']);

    const row = component.$rows()[0];
    expect(row.items.map(item => item.configurationId)).toEqual(['a', 'b']);
    expect(row.selectedConfigurationId).toBe('b');
    expect(lastValid).toBeTrue();
  });

  it('shows the contract title from the provider manifest translations', () => {
    externalPluginService.getContractProviders.and.returnValue(of([provider('a')]));
    externalPluginService.getDefinition.and.returnValue(
      of({
        manifest: {
          provides: [{contract: 'nl.ritense.openplan@1', operations: []}],
          translations: {
            nl: {
              'contracts.nl.ritense.openplan@1.title': 'Open Plan Plannen API',
            },
          },
        },
      } as unknown as ExternalPluginDefinition)
    );
    TestBed.inject(TranslateService).use('nl');

    applyContracts(['nl.ritense.openplan@1']);

    expect(externalPluginService.getDefinition).toHaveBeenCalledWith('definition-id');
    expect(component.$rows()[0].title).toBe('Open Plan Plannen API');
  });
});
