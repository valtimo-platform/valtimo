import {Component} from '@angular/core';
import {BasicCaseWidget} from '../../../../../../models';
import {BehaviorSubject, Observable, switchMap, tap} from 'rxjs';
import {PermissionResponse, PermissionService} from '@valtimo/access-control';
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
