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

  private _updateBpmnViewFunction!: () => void;

  private _activityIdBusinessIdMap: Record<string, string> = {};

  constructor(private readonly processLinkService: ProcessLinkService) {
    this.openSelectedProcessDefinitionSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
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
    if (!this._activityIdBusinessIdMap[activityId]) return;
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
    if (!this._updateBpmnViewFunction) return;
    this._updateBpmnViewFunction();
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
}
