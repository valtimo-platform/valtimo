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

import {Injectable, OnDestroy} from '@angular/core';
import {ProcessDefinition} from '@valtimo/process';
import {BehaviorSubject, filter, Observable, Subject, Subscription} from 'rxjs';
import {distinctUntilChanged} from 'rxjs/operators';
import {isEqual} from 'lodash';
import {
  ProcessLink,
  ProcessLinkCreateEvent,
  ProcessLinkDeleteEvent,
  ProcessLinkService,
  ProcessLinkUpdateEvent,
} from '@valtimo/process-link';
import {OpenProcessLinkModalEvent} from '../models';
import {CaseManagementParams, ManagementContext} from '@valtimo/shared';
import {FormDefinitionOption, FormService} from '@valtimo/form';

@Injectable()
export class ProcessManagementEditorService implements OnDestroy {
  private readonly _selectionProcessDefinitionSubject$ =
    new BehaviorSubject<ProcessDefinition | null>(null);

  public get selectionProcessDefinition$(): Observable<ProcessDefinition> {
    return this._selectionProcessDefinitionSubject$.pipe(
      filter(selectedProcessDefinition => !!selectedProcessDefinition?.id),
      distinctUntilChanged((previous, current) => isEqual(previous, current))
    );
  }

  public get selectionProcessDefinition(): ProcessDefinition {
    return this._selectionProcessDefinitionSubject$.getValue();
  }

  private readonly _processLinksForSelectedDefinition$ = new BehaviorSubject<ProcessLink[]>([]);

  public get processLinksForSelectedDefinition$(): Observable<ProcessLink[]> {
    return this._processLinksForSelectedDefinition$.asObservable();
  }

  public get processLinksForSelectedDefinition(): ProcessLink[] {
    return this._processLinksForSelectedDefinition$.getValue();
  }

  private readonly _processLinksFetchedForSelectedDefinition$ = new BehaviorSubject<boolean>(false);

  private readonly _subscriptions = new Subscription();

  private readonly _openProcessLinkModalEvents$ = new Subject<OpenProcessLinkModalEvent>();

  public get openProcessLinkModalEvents$(): Observable<OpenProcessLinkModalEvent> {
    return this._openProcessLinkModalEvents$.asObservable();
  }

  public setSelectedProcessDefinition(definition: ProcessDefinition): void {
    this._selectionProcessDefinitionSubject$.next(definition);
  }

  private readonly _caseManagementRouteParams$ = new BehaviorSubject<
    [ManagementContext, CaseManagementParams] | null
  >(null);

  private readonly _formDefinitionOptions$ = new BehaviorSubject<FormDefinitionOption[]>([]);

  public get formDefinitionOptions(): FormDefinitionOption[] {
    return this._formDefinitionOptions$.getValue();
  }

  private _updateBpmnViewFunction!: () => void;

  private _updatingBpmnView = false;

  private _activityIdBusinessIdMap: Record<string, string> = {};

  constructor(
    private readonly processLinkService: ProcessLinkService,
    private readonly formService: FormService
  ) {
    this.openSelectedProcessDefinitionSubscription();
    this.openFormDefinitionOptionsSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public setCaseManagementRouteParams(
    context: ManagementContext,
    params: CaseManagementParams
  ): void {
    this._caseManagementRouteParams$.next([context, params]);
  }

  public sendOpenProcessLinkModalEvent(
    event: OpenProcessLinkModalEvent,
    updateBpmnViewFunction: () => void
  ): void {
    this._updateBpmnViewFunction = updateBpmnViewFunction;
    this._openProcessLinkModalEvents$.next(event);
  }

  public updateProcessLink(event: ProcessLinkUpdateEvent): void {
    this.setProcessLinksForSelectedDefinition(
      this.processLinksForSelectedDefinition.map(processLink => {
        if (processLink.activityId === event.activityId) {
          return {...processLink, ...(event as any)};
        }

        return processLink;
      })
    );

    this.updateBpmnView();
  }

  public createProcessLink(event: ProcessLinkCreateEvent): void {
    this.setProcessLinksForSelectedDefinition([
      ...this.processLinksForSelectedDefinition,
      event as any,
    ]);

    this.updateBpmnView();
  }

  public deleteProcessLink(
    event: ProcessLinkDeleteEvent,
    updateBpmnViewFunction?: () => void
  ): void {
    if (updateBpmnViewFunction) {
      this._updateBpmnViewFunction = updateBpmnViewFunction;
    }

    this.setProcessLinksForSelectedDefinition(
      this.processLinksForSelectedDefinition.filter(
        processLink => processLink.activityId !== event.activityId
      )
    );

    this.updateBpmnView();
  }

  public setProcessLinksForSelectedDefinition(processLinks: ProcessLink[]): void {
    this._processLinksForSelectedDefinition$.next(processLinks);
  }

  public setActivityIdBusinessIdMap(activityIdBusinessIdMap: Record<string, string>): void {
    this._activityIdBusinessIdMap = activityIdBusinessIdMap;
  }

  public updateProcessLinksOnIdChange(activityId: string, newBusinessId: string): void {
    const newBusinessIdWithoutLabelString = newBusinessId.replace('_label', '');

    if (
      !this._activityIdBusinessIdMap[activityId] ||
      this._activityIdBusinessIdMap[activityId] === newBusinessIdWithoutLabelString
    ) {
      return;
    }

    this.updateProcessLinkId(this._activityIdBusinessIdMap[activityId], newBusinessId);
    this._activityIdBusinessIdMap = {...this._activityIdBusinessIdMap, [activityId]: newBusinessId};
  }

  private openSelectedProcessDefinitionSubscription(): void {
    this._subscriptions.add(
      this.selectionProcessDefinition$.subscribe(definition => {
        this.fetchProcessLinksForDefinition(definition.id);
      })
    );
  }

  private fetchProcessLinksForDefinition(processDefinitionId: string): void {
    this.processLinkService.getProcessLink({processDefinitionId}).subscribe(res => {
      this.setProcessLinksForSelectedDefinition(res);
    });
  }

  private updateBpmnView(): void {
    if (!this._updateBpmnViewFunction || this._updatingBpmnView) return;
    this._updatingBpmnView = true;
    this._updateBpmnViewFunction();
    this._updatingBpmnView = false;
  }

  private updateProcessLinkId(oldBusinessId: string, newBusinessId: string): void {
    this.setProcessLinksForSelectedDefinition(
      this.processLinksForSelectedDefinition.map(processLink => {
        if (processLink.activityId === oldBusinessId) {
          return {...processLink, activityId: newBusinessId};
        }

        return processLink;
      })
    );

    this.updateBpmnView();
  }

  private openFormDefinitionOptionsSubscription(): void {
    this._subscriptions.add(
      this._caseManagementRouteParams$
        .pipe(
          filter((params): params is [ManagementContext, CaseManagementParams] => params !== null)
        )
        .subscribe(([context, params]) => {
          if (context === 'independent') {
            this.formService
              .getAllUnlinkedFormDefinitions()
              .subscribe(options => this._formDefinitionOptions$.next(options));
          } else {
            this.formService
              .getAllFormDefinitionsForCaseDefinition(
                params.caseDefinitionKey,
                params.caseDefinitionVersionTag
              )
              .subscribe(options => this._formDefinitionOptions$.next(options));
          }
        })
    );
  }
}
