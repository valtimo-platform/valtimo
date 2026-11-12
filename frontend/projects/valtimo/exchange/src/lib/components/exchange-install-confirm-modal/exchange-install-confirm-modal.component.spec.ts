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
import {TranslateModule} from '@ngx-translate/core';
import {ExchangeArtifact, ExchangeDependencyStatus} from '../../models';
import {ExchangeInstallConfirmModalComponent} from './exchange-install-confirm-modal.component';

describe('ExchangeInstallConfirmModalComponent', () => {
  let fixture: ComponentFixture<ExchangeInstallConfirmModalComponent>;

  const artifact = (overrides: Partial<ExchangeArtifact> = {}): ExchangeArtifact => ({
    publicationId: 'pub-1',
    publicationName: 'Plan',
    artifactId: 'art-1',
    type: 'CASE_DEFINITION',
    title: 'Plan 1.0.0',
    versionTag: '1.0.0',
    fileName: 'plan.zip',
    valtimoVersion: '13.60.0',
    runningValtimoVersion: '13.53.0',
    compatibility: 'COMPATIBLE',
    dependencies: [],
    ...overrides,
  });

  const statuses = (
    installed: boolean | null,
    type: 'BUILDING_BLOCK' | 'PLUGIN' = 'BUILDING_BLOCK'
  ) =>
    [
      {dependency: {type, key: 'dep', title: 'Dep', versionTag: null}, installed},
    ] as Array<ExchangeDependencyStatus>;

  const render = (
    artifactValue: ExchangeArtifact,
    dependencies: Array<ExchangeDependencyStatus> = []
  ): void => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('artifact', artifactValue);
    fixture.componentRef.setInput('dependencies', dependencies);
    fixture.detectChanges();
  };

  const find = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ExchangeInstallConfirmModalComponent, TranslateModule.forRoot()],
    });
    fixture = TestBed.createComponent(ExchangeInstallConfirmModalComponent);
  });

  it('shows the name and version', () => {
    render(artifact());

    expect(find('exchange-confirm-name')?.textContent).toContain('Plan');
    expect(find('exchange-confirm-version')?.textContent).toContain('1.0.0');
  });

  it('shows the compatibility warning when the artifact is for a newer Valtimo', () => {
    render(artifact({compatibility: 'NEWER'}));

    expect(find('exchange-confirm-compatibility-warning')).not.toBeNull();
  });

  it('shows no compatibility warning for a compatible artifact', () => {
    render(artifact());

    expect(find('exchange-confirm-compatibility-warning')).toBeNull();
  });

  it('warns about missing building blocks', () => {
    render(artifact(), statuses(false));

    expect(find('exchange-confirm-missing-warning')).not.toBeNull();
    expect(find('exchange-confirm-dependency-missing')).not.toBeNull();
  });

  it('does not warn when the building blocks are installed or the dependency is a plugin', () => {
    render(artifact(), statuses(true));
    expect(find('exchange-confirm-missing-warning')).toBeNull();

    render(artifact(), statuses(null, 'PLUGIN'));
    expect(find('exchange-confirm-missing-warning')).toBeNull();
  });

  it('emits confirm and cancel', () => {
    render(artifact());
    const confirm = jasmine.createSpy('confirm');
    const cancel = jasmine.createSpy('cancel');
    fixture.componentInstance.confirmEvent.subscribe(confirm);
    fixture.componentInstance.cancelEvent.subscribe(cancel);

    find('exchange-confirm-install')?.click();
    find('exchange-confirm-cancel')?.click();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
