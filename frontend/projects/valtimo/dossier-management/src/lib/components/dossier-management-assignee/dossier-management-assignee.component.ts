/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {BehaviorSubject, map, Observable, switchMap} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {tap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-dossier-management-assignee',
  templateUrl: './dossier-management-assignee.component.html',
  styleUrls: ['./dossier-management-assignee.component.css'],
})
export class DossierManagementAssigneeComponent {
  readonly disabled$ = new BehaviorSubject<boolean>(false);

  private readonly _refresh$ = new BehaviorSubject<null>(null);

  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || '')
  );

  readonly currentValue$: Observable<CaseSettings> = this._refresh$.pipe(
    switchMap(() => this.documentDefinitionName$),
    switchMap(documentDefinitionName =>
      this.documentService.getCaseSettingsForManagement(documentDefinitionName)
    ),
    tap(() => this.loading$.next(false))
  );

  constructor(
    private readonly documentService: DocumentService,
    private route: ActivatedRoute
  ) {
    this.disabled$ = new BehaviorSubject<boolean>(false);
  }

  updateCaseSettings(caseSettings: CaseSettings, documentDefinitionName: string): void {
    this.disableInput();

    this.documentService
      .patchCaseSettingsForManagement(documentDefinitionName, caseSettings)
      .subscribe(
        () => {
          this.enableInput();
          this.refreshSettings();
        },
        () => {
          this.enableInput();
        }
      );
  }

  disableInput(): void {
    this.disabled$.next(true);
  }

  enableInput(): void {
    this.disabled$.next(false);
  }

  private refreshSettings(): void {
    this._refresh$.next(null);
  }

  toggleAssignee(currentSettings: CaseSettings, documentDefinitionName: string) {
    this.updateCaseSettings(
      {
        canHaveAssignee: !currentSettings?.canHaveAssignee,
        autoAssignTasks: currentSettings.autoAssignTasks,
      },
      documentDefinitionName
    );
  }

  toggleTaskAssignment(currentSettings: CaseSettings, documentDefinitionName: string) {
    this.updateCaseSettings(
      {
        canHaveAssignee: currentSettings?.canHaveAssignee,
        autoAssignTasks: !currentSettings.autoAssignTasks,
      },
      documentDefinitionName
    );
  }
}
