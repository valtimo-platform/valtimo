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
import {Component, Input} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Information16} from '@carbon/icons';
import {CaseSettings, DocumentService} from '@valtimo/document';
import {CaseManagementParams, getCaseManagementRouteParams} from '@valtimo/shared';
import {IconService} from 'carbon-components-angular';
import {BehaviorSubject, finalize, map, Observable, switchMap, of, debounceTime, startWith} from 'rxjs';
import {tap} from 'rxjs/operators';

@Component({
  standalone: false,
  selector: 'valtimo-case-management-case-handler',
  templateUrl: './case-management-case-handler.component.html',
  styleUrl: './case-management-case-handler.component.scss',
})
export class CaseManagementCaseHandlerComponent {
  @Input() public readonly isReadOnly: boolean;

  public readonly disabled$ = new BehaviorSubject<boolean>(false);

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly params$: Observable<CaseManagementParams> = getCaseManagementRouteParams(
    this.route
  ).pipe(
    map((params: CaseManagementParams | undefined) => ({
      caseDefinitionKey: params?.caseDefinitionKey ?? '',
      caseDefinitionVersionTag: params?.caseDefinitionVersionTag ?? '',
    }))
  );

  public readonly caseDefinitionKey$: Observable<string> | undefined = this.params$?.pipe(
    map(({caseDefinitionKey}) => caseDefinitionKey || '')
  );

  public readonly caseDefinitionVersionTag$: Observable<string> | undefined = this.params$?.pipe(
    map(({caseDefinitionVersionTag}) => caseDefinitionVersionTag || '')
  );

  private readonly _refresh$ = new BehaviorSubject<null>(null);

  public readonly currentValue$: Observable<CaseSettings> = this._refresh$.pipe(
    switchMap(() => this.params$),
    switchMap(({caseDefinitionKey, caseDefinitionVersionTag}) =>
      this.documentService.getCaseSettingsForManagement(caseDefinitionKey, caseDefinitionVersionTag)
    ),
    tap(() => this.loading$.next(false))
  );

  constructor(
    private readonly documentService: DocumentService,
    private readonly iconService: IconService,
    private route: ActivatedRoute
  ) {
    this.iconService.registerAll([Information16]);
  }

  public updateCaseSettings(
    caseSettings: CaseSettings,
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): void {
    this.disableInput();

    this.documentService
      .patchCaseSettingsForManagement(caseDefinitionKey, caseDefinitionVersionTag, caseSettings)
      .pipe(finalize(() => this.enableInput()))
      .subscribe(() => this.refreshSettings());
  }

  public disableInput(): void {
    this.disabled$.next(true);
  }

  public enableInput(): void {
    this.disabled$.next(false);
  }

  private refreshSettings(): void {
    this._refresh$.next(null);
  }

  public toggleAssignee(
    currentSettings: CaseSettings,
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ) {
    const newCanHaveAssignee = !currentSettings?.canHaveAssignee;

    this.updateCaseSettings(
      {
        canHaveAssignee: newCanHaveAssignee,
        autoAssignTasks: newCanHaveAssignee ? currentSettings.autoAssignTasks : false,
      },
      caseDefinitionKey,
      caseDefinitionVersionTag
    );
  }

  public toggleTaskAssignment(
    currentSettings: CaseSettings,
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ) {
    this.updateCaseSettings(
      {
        canHaveAssignee: currentSettings?.canHaveAssignee,
        autoAssignTasks: !currentSettings.autoAssignTasks,
      },
      caseDefinitionKey,
      caseDefinitionVersionTag
    );
  }
}
