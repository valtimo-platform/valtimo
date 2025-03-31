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

import {Component} from '@angular/core';
import {CaseSettings, DocumentService} from '@valtimo/document';
import {BehaviorSubject, finalize, map, Observable, switchMap} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {tap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-case-management-case-handler',
  templateUrl: './case-management-case-handler.component.html',
  styleUrl: './case-management-case-handler.component.scss',
})
export class CaseManagementCaseHandlerComponent {
  public readonly disabled$ = new BehaviorSubject<boolean>(false);

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly params$: Observable<any> | undefined = this.route.parent?.params.pipe(
    map(({caseDefinitionName, caseVersionTag}) => ({
      caseDefinitionKey: caseDefinitionName,
      caseDefinitionVersionTag: caseVersionTag,
    }))
  );

  public readonly caseDefinitionKey$: Observable<string> | undefined =
    this.route.parent?.params.pipe(map(({caseDefinitionKey}) => caseDefinitionKey || ''));

  public readonly caseVersionTag$: Observable<string> | undefined = this.route.parent?.params.pipe(
    map(({caseVersionTag}) => caseVersionTag || '')
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
    private route: ActivatedRoute
  ) {}

  public updateCaseSettings(
    caseSettings: CaseSettings,
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): void {
    this.disableInput();

    this.documentService
      .patchCaseSettingsForManagement(caseDefinitionKey, caseDefinitionVersionTag, caseSettings)
      .pipe(finalize(() => this.enableInput()))
      .subscribe({
        next: () => this.refreshSettings(),
      });
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
