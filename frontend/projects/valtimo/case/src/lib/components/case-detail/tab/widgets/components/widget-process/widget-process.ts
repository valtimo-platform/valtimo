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

import {BasicCaseWidget} from '../../../../../../models';
import {BehaviorSubject, Observable, switchMap} from 'rxjs';
import {PermissionService} from '@valtimo/access-control';
import {DocumentService, ProcessDocumentDefinition} from '@valtimo/document';
import {
  CAN_CREATE_CAMUNDA_EXECUTION_PERMISSION,
  WIDGET_PERMISSION_RESOURCE,
} from '../../widgets.permissions';

export class WidgetProcess {
  private readonly _baseWidgetConfiguration$ = new BehaviorSubject<BasicCaseWidget | null>(null);
  protected set baseWidgetConfiguration(value: BasicCaseWidget) {
    this._baseWidgetConfiguration$.next(value);
  }

  public readonly canCreateCamundaExecution$: Observable<boolean> =
    this._baseWidgetConfiguration$.pipe(
      switchMap((widgetConfiguration: BasicCaseWidget | null) =>
        this.documentService.findProcessDocumentDefinitionsByProcessDefinitionKey(
          widgetConfiguration?.actions?.[0].processDefinitionKey ?? ''
        )
      ),
      switchMap((processDefintions: ProcessDocumentDefinition[]) =>
        this.permissionService.requestPermission(CAN_CREATE_CAMUNDA_EXECUTION_PERMISSION, {
          resource: WIDGET_PERMISSION_RESOURCE.camundaProcessDefinition,
          identifier: processDefintions[0].latestVersionId,
        })
      )
    );

  constructor(
    protected readonly documentService: DocumentService,
    protected readonly permissionService: PermissionService
  ) {}
}
