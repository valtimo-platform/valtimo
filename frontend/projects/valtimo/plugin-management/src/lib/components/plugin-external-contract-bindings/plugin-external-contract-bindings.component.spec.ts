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
import {of, throwError} from 'rxjs';
import {
  ExternalPluginContractBindingEntry,
  ExternalPluginContractBindingResponse,
  ExternalPluginContractProvider,
  ExternalPluginDeclaredContract,
  ExternalPluginService,
} from '@valtimo/plugin';
import {PluginExternalContractBindingsComponent} from './plugin-external-contract-bindings.component';
import {PLUGIN_EXTERNAL_CONTRACT_BINDINGS_TEST_IDS} from '../../constants';

describe('PluginExternalContractBindingsComponent', () => {
  const CONTRACT = 'nl.ritense.openplan@1';

  let fixture: ComponentFixture<PluginExternalContractBindingsComponent>;
  let component: PluginExternalContractBindingsComponent;
  let externalPluginService: jasmine.SpyObj<ExternalPluginService>;
  let lastBindings: Array<ExternalPluginContractBindingEntry> | null = null;
  let lastValid: boolean | null = null;

  const provider = (
    configurationId: string,
    overrides: Partial<ExternalPluginContractProvider> = {}
  ): ExternalPluginContractProvider => ({
    configurationId,
    configurationTitle: `Open Plan ${configurationId}`,
    definitionId: 'definition-id',
    pluginId: 'openplan',
    version: '1.0.0',
    hostId: 'host-id',
    hostName: 'Plugin host',
    hostKind: 'PLUGIN_HOST',
    available: true,
    contractTitle: null,
    contractTranslations: {},
    operations: [
      {key: 'list', title: 'List', mode: 'sync', timeout: null},
      {key: 'export', title: 'Export', mode: 'job', timeout: 'PT2H'},
    ],
    ...overrides,
  });

  const declared = (operations: Array<string> | null = null): ExternalPluginDeclaredContract => ({
    contract: CONTRACT,
    operations,
  });

  const binding = (targetConfigurationId: string): ExternalPluginContractBindingResponse => ({
    contract: CONTRACT,
    targetConfigurationId,
    targetConfigurationTitle: `Bound ${targetConfigurationId}`,
  });

  const apply = (
    contracts: Array<ExternalPluginDeclaredContract>,
    edit: {self: string; bindings: Array<ExternalPluginContractBindingResponse>} | null = null
  ): void => {
    component.contracts = contracts;
    component.selfConfigurationId = edit?.self ?? null;
    component.currentBindings = edit?.bindings ?? [];
    component.ngOnChanges({contracts: new SimpleChange([], contracts, true)});
  };

  const row = () => component.$rows()[0];
  const selectedTarget = (): string | null | undefined =>
    row().items.find(item => item.selected)?.targetConfigurationId;
  const item = (targetConfigurationId: string | null) =>
    row().items.find(candidate => candidate.targetConfigurationId === targetConfigurationId)!;

  beforeEach(() => {
    externalPluginService = jasmine.createSpyObj<ExternalPluginService>('ExternalPluginService', [
      'getContractProviders',
    ]);

    TestBed.configureTestingModule({
      imports: [PluginExternalContractBindingsComponent, TranslateModule.forRoot()],
      providers: [{provide: ExternalPluginService, useValue: externalPluginService}],
    });

    fixture = TestBed.createComponent(PluginExternalContractBindingsComponent);
    component = fixture.componentInstance;
    component.bindingsChangeEvent.subscribe(bindings => (lastBindings = bindings));
    component.validEvent.subscribe(valid => (lastValid = valid));
    lastBindings = null;
    lastValid = null;
  });

  it('is valid without declared contracts', () => {
    apply([]);

    expect(externalPluginService.getContractProviders).not.toHaveBeenCalled();
    expect(lastBindings).toEqual([]);
    expect(lastValid).toBeTrue();
  });

  it('offers "Leave unbound" next to every provider', () => {
    externalPluginService.getContractProviders.and.returnValue(of([provider('a'), provider('b')]));

    apply([declared()]);

    expect(externalPluginService.getContractProviders).toHaveBeenCalledWith(CONTRACT);
    expect(row().items.map(candidate => candidate.targetConfigurationId)).toEqual([null, 'a', 'b']);
  });

  describe('when creating a configuration', () => {
    it('pre-selects the only compatible provider', () => {
      externalPluginService.getContractProviders.and.returnValue(of([provider('a')]));

      apply([declared()]);

      expect(selectedTarget()).toBe('a');
      expect(lastBindings).toEqual([{contract: CONTRACT, targetConfigurationId: 'a'}]);
      expect(lastValid).toBeTrue();
    });

    it('waits for a choice between several compatible providers', () => {
      externalPluginService.getContractProviders.and.returnValue(
        of([provider('a'), provider('b')])
      );

      apply([declared()]);

      expect(selectedTarget()).toBeUndefined();
      expect(row().invalidTextKey).toBe('pluginManagement.contracts.choiceRequired');
      expect(lastValid).toBeFalse();

      component.onChoiceSelected(CONTRACT, {item: item('b')});

      expect(lastBindings).toEqual([{contract: CONTRACT, targetConfigurationId: 'b'}]);
      expect(lastValid).toBeTrue();
    });

    it('leaves the contract unbound, with a hint, when nothing provides it', () => {
      externalPluginService.getContractProviders.and.returnValue(of([]));

      apply([declared()]);

      expect(selectedTarget()).toBeNull();
      expect(row().hintKey).toBe('pluginManagement.contracts.noProvider');
      expect(lastBindings).toEqual([]);
      expect(lastValid).toBeTrue();
    });

    it('lets the admin leave a contract unbound on purpose', () => {
      externalPluginService.getContractProviders.and.returnValue(of([provider('a')]));
      apply([declared()]);

      component.onChoiceSelected(CONTRACT, {item: item(null)});

      expect(row().hintKey).toBe('pluginManagement.contracts.unboundHint');
      expect(lastBindings).toEqual([]);
      expect(lastValid).toBeTrue();
    });
  });

  describe('compatibility with declared operations', () => {
    it('disables a provider lacking a declared operation and names what it lacks', () => {
      externalPluginService.getContractProviders.and.returnValue(
        of([
          provider('a', {operations: [{key: 'list', title: 'List', mode: 'sync', timeout: null}]}),
          provider('b'),
        ])
      );

      apply([declared(['list', 'export'])]);

      expect(item('a').disabled).toBeTrue();
      expect(item('a').content).toContain('pluginManagement.contracts.missingOperations');
      expect(item('b').disabled).toBeFalse();
      expect(selectedTarget()).toBe('b');
    });

    it('never pre-selects an incompatible provider', () => {
      externalPluginService.getContractProviders.and.returnValue(
        of([provider('a', {operations: []})])
      );

      apply([declared(['list'])]);

      expect(selectedTarget()).toBeNull();
      expect(row().hintKey).toBe('pluginManagement.contracts.noCompatibleProvider');
      expect(lastBindings).toEqual([]);
    });

    it('accepts any provider for a contract declared without operations', () => {
      externalPluginService.getContractProviders.and.returnValue(
        of([provider('a', {operations: []})])
      );

      apply([declared(null)]);

      expect(item('a').disabled).toBeFalse();
      expect(selectedTarget()).toBe('a');
    });
  });

  describe('when editing a configuration', () => {
    it('keeps the saved binding and never offers the configuration itself', () => {
      externalPluginService.getContractProviders.and.returnValue(
        of([provider('self'), provider('a'), provider('b')])
      );

      apply([declared()], {self: 'self', bindings: [binding('b')]});

      expect(row().items.map(candidate => candidate.targetConfigurationId)).toEqual([
        null,
        'a',
        'b',
      ]);
      expect(selectedTarget()).toBe('b');
      expect(lastBindings).toEqual([{contract: CONTRACT, targetConfigurationId: 'b'}]);
      expect(lastValid).toBeTrue();
    });

    it('starts at "Leave unbound" for a contract without a binding', () => {
      externalPluginService.getContractProviders.and.returnValue(of([provider('a')]));

      apply([declared()], {self: 'self', bindings: []});

      expect(selectedTarget()).toBeNull();
      expect(lastBindings).toEqual([]);
      expect(lastValid).toBeTrue();
    });

    it('marks a binding whose target does not provide the contract until the admin chooses', () => {
      externalPluginService.getContractProviders.and.returnValue(of([provider('a')]));

      apply([declared()], {self: 'self', bindings: [binding('gone')]});

      expect(row().stale).toEqual({targetTitle: 'Bound gone', missingOperations: []});
      expect(row().invalidTextKey).toBe('pluginManagement.contracts.staleBinding');
      expect(selectedTarget()).toBeUndefined();
      expect(lastValid).toBeFalse();

      component.onChoiceSelected(CONTRACT, {item: item(null)});

      expect(row().stale).toBeNull();
      expect(lastBindings).toEqual([]);
      expect(lastValid).toBeTrue();
    });

    it('marks a binding whose target lacks a declared operation', () => {
      externalPluginService.getContractProviders.and.returnValue(
        of([provider('a', {operations: [{key: 'list', title: null, mode: null, timeout: null}]})])
      );

      apply([declared(['list', 'export'])], {self: 'self', bindings: [binding('a')]});

      expect(row().stale?.missingOperations).toEqual(['export']);
      expect(row().invalidTextKey).toBe('pluginManagement.contracts.incompatibleBinding');
      expect(lastValid).toBeFalse();
    });
  });

  describe('provider lookup', () => {
    it('is invalid while providers load', () => {
      externalPluginService.getContractProviders.and.returnValue(of());

      apply([declared()]);

      expect(row().state).toBe('loading');
      expect(lastValid).toBeFalse();
    });

    it('shows a failed lookup as an error that can be retried', () => {
      externalPluginService.getContractProviders.and.returnValue(
        throwError(() => new Error('down'))
      );

      apply([declared()]);

      expect(row().state).toBe('error');
      expect(row().items).toEqual([]);
      expect(lastValid).toBeFalse();

      externalPluginService.getContractProviders.and.returnValue(of([provider('a')]));
      component.onRetry(CONTRACT);

      expect(externalPluginService.getContractProviders).toHaveBeenCalledTimes(2);
      expect(row().state).toBe('ready');
      expect(selectedTarget()).toBe('a');
      expect(lastValid).toBeTrue();
    });

    it('labels a provider without a known host', () => {
      externalPluginService.getContractProviders.and.returnValue(
        of([provider('a', {hostName: null, hostKind: null})])
      );

      apply([declared()]);

      expect(item('a').content).toBe('Open Plan a — openplan@1.0.0');
    });
  });

  describe('rendering', () => {
    const byTestId = (testId: string): HTMLElement | null =>
      fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`);

    it('renders a dropdown per contract', () => {
      externalPluginService.getContractProviders.and.returnValue(of([provider('a')]));
      fixture.componentRef.setInput('contracts', [declared()]);

      fixture.detectChanges();

      expect(byTestId(PLUGIN_EXTERNAL_CONTRACT_BINDINGS_TEST_IDS.row + CONTRACT)).not.toBeNull();
      expect(
        byTestId(PLUGIN_EXTERNAL_CONTRACT_BINDINGS_TEST_IDS.providerDropdown + CONTRACT)
      ).not.toBeNull();
    });

    it('renders a failed lookup with a retry button', () => {
      externalPluginService.getContractProviders.and.returnValue(
        throwError(() => new Error('down'))
      );
      fixture.componentRef.setInput('contracts', [declared()]);

      fixture.detectChanges();

      expect(
        byTestId(PLUGIN_EXTERNAL_CONTRACT_BINDINGS_TEST_IDS.providerDropdown + CONTRACT)
      ).toBeNull();
      expect(
        byTestId(PLUGIN_EXTERNAL_CONTRACT_BINDINGS_TEST_IDS.retryButton + CONTRACT)
      ).not.toBeNull();
    });
  });

  describe('labels', () => {
    it('takes the contract title from the provider translations, then its own title', () => {
      externalPluginService.getContractProviders.and.returnValue(
        of([
          provider('a', {
            contractTitle: 'Open Plan',
            contractTranslations: {nl: {[`contracts.${CONTRACT}.title`]: 'Open Plan Plannen'}},
          }),
        ])
      );

      apply([declared()]);

      expect(row().title).toBe('Open Plan');

      TestBed.inject(TranslateService).use('nl');

      expect(row().title).toBe('Open Plan Plannen');
    });

    it('follows language changes', () => {
      const translateService = TestBed.inject(TranslateService);
      translateService.setTranslation('nl', {
        pluginManagement: {contracts: {leaveUnbound: 'Niet koppelen'}},
      });
      externalPluginService.getContractProviders.and.returnValue(of([provider('a')]));
      apply([declared()]);

      translateService.use('nl');

      expect(item(null).content).toBe('Niet koppelen');
    });
  });
});
