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
import {Inject, Injectable, OnDestroy, Optional} from '@angular/core';
import {BehaviorSubject, map, Observable, Subject, Subscription} from 'rxjs';
import {
  FormCustomComponentConfig,
  ModalParams,
  ProcessLink,
  ProcessLinkCreateEvent,
  ProcessLinkDeleteEvent,
  ProcessLinkEditMode,
  ProcessLinkType,
  ProcessLinkUpdateEvent,
} from '../models';
import {PluginStateService} from './plugin-state.service';
import {ProcessLinkButtonService} from './process-link-button.service';
import {ProcessLinkStepService} from './process-link-step.service';
import {FORM_CUSTOM_COMPONENT_TOKEN} from '../constants';

@Injectable({
  providedIn: 'root',
})
export class ProcessLinkStateService implements OnDestroy {
  private readonly _showModal$ = new BehaviorSubject<boolean>(false);
  private readonly _availableProcessLinkTypes$ = new BehaviorSubject<Array<ProcessLinkType>>([]);
  private readonly _elementName$ = new BehaviorSubject<string>('');
  private readonly _selectedProcessLinkTypeId$ = new BehaviorSubject<string>('');
  private readonly _viewModelEnabled$ = new BehaviorSubject<boolean>(false);
  private readonly _url$ = new BehaviorSubject<string>('');
  private readonly _saving$ = new BehaviorSubject<boolean>(false);
  private readonly _modalParams$ = new BehaviorSubject<ModalParams>(undefined);
  private readonly _selectedProcessLink$ = new BehaviorSubject<ProcessLink>(undefined);
  private readonly _processLinkEditMode$ = new BehaviorSubject<ProcessLinkEditMode>(
    ProcessLinkEditMode.SAVE_TO_BACKEND
  );
  private readonly _processLinkUpdateEvents$ = new Subject<ProcessLinkUpdateEvent>();
  private readonly _processLinkCreateEvents$ = new Subject<ProcessLinkCreateEvent>();
  private readonly _processLinkDeleteEvents$ = new Subject<ProcessLinkDeleteEvent>();

  public get processLinkUpdateEvents$(): Observable<ProcessLinkUpdateEvent> {
    return this._processLinkUpdateEvents$.asObservable();
  }
  public get processLinkCreateEvents$(): Observable<ProcessLinkCreateEvent> {
    return this._processLinkCreateEvents$.asObservable();
  }
  public get processLinkDeleteEvents$(): Observable<ProcessLinkDeleteEvent> {
    return this._processLinkDeleteEvents$.asObservable();
  }
  public get showModal$(): Observable<boolean> {
    return this._showModal$.asObservable();
  }
  public get elementName$(): Observable<string> {
    return this._elementName$.asObservable();
  }
  get availableProcessLinkTypes$(): Observable<Array<ProcessLinkType>> {
    return this._availableProcessLinkTypes$.asObservable().pipe(
      map(types => {
        if (!this.formCustomComponentConfig) {
          return types.map(type => {
            if (type.processLinkType === 'ui-component') {
              type.enabled = false;
            }
            return type;
          });
        }
        return types;
      })
    );
  }

  public get hideProgressIndicator$(): Observable<boolean> {
    return this._availableProcessLinkTypes$
      .asObservable()
      .pipe(
        map(
          availableTypes =>
            Array.isArray(availableTypes) &&
            availableTypes.length === 1 &&
            (availableTypes[0]?.processLinkType === 'form' ||
              availableTypes[0]?.processLinkType === 'form-flow')
        )
      );
  }
  public get selectedProcessLinkTypeId$(): Observable<string> {
    return this._selectedProcessLinkTypeId$.asObservable();
  }
  public get saving$(): Observable<boolean> {
    return this._saving$.asObservable();
  }
  public get modalParams$(): Observable<ModalParams> {
    return this._modalParams$.asObservable();
  }
  public get selectedProcessLink$(): Observable<ProcessLink> {
    return this._selectedProcessLink$.asObservable();
  }
  public get typeOfSelectedProcessLink$(): Observable<string> {
    return this.selectedProcessLink$.pipe(map(processLink => processLink?.processLinkType || ''));
  }
  public get processLinkEditMode(): ProcessLinkEditMode {
    return this._processLinkEditMode$.getValue();
  }
  public get viewModelEnabled$(): Observable<boolean> {
    return this._viewModelEnabled$.asObservable();
  }
  public get url$(): Observable<string> {
    return this._url$.asObservable();
  }

  private _availableProcessLinkTypesSubscription!: Subscription;

  constructor(
    private readonly processLinkStepService: ProcessLinkStepService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly pluginStateService: PluginStateService,
    @Optional()
    @Inject(FORM_CUSTOM_COMPONENT_TOKEN)
    private readonly formCustomComponentConfig: FormCustomComponentConfig
  ) {
    this.openAvailableProcessLinkTypesSubscription();
  }

  public ngOnDestroy(): void {
    this._availableProcessLinkTypesSubscription?.unsubscribe();
  }

  public setAvailableProcessLinkTypes(processLinkTypes: Array<ProcessLinkType>): void {
    const hasOneOption = processLinkTypes.length === 1;
    this._availableProcessLinkTypes$.next(processLinkTypes);
    this.processLinkStepService.setHasOneProcessLinkType(hasOneOption);

    if (hasOneOption) {
      this.selectProcessLinkType(processLinkTypes[0].processLinkType, hasOneOption);
    }
  }

  public setElementName(name: string): void {
    this._elementName$.next(name);
  }

  public showModal(): void {
    this._showModal$.next(true);
  }

  public closeModal(): void {
    this._showModal$.next(false);

    setTimeout(() => {
      this.reset();
    }, 240);
  }

  public selectProcessLinkType(processLinkTypeId: string, hasOneOption?: boolean): void {
    this._selectedProcessLinkTypeId$.next(processLinkTypeId);
    this.processLinkStepService.setProcessLinkTypeSteps(processLinkTypeId, hasOneOption);
  }

  public setViewModelEnabled(viewModelEnabled: boolean): void {
    this._viewModelEnabled$.next(viewModelEnabled);
  }

  public clearSelectedProcessLinkType(): void {
    this._selectedProcessLinkTypeId$.next('');
  }

  public startSaving(): void {
    this._saving$.next(true);
    this.processLinkStepService.disableSteps();
  }

  public stopSaving(): void {
    this._saving$.next(false);
    this.processLinkStepService.enableSteps();
  }

  public setInitial(): void {
    const availableTypes = this._availableProcessLinkTypes$.getValue();
    this.buttonService.resetButtons();
    this.processLinkStepService.setInitialSteps(availableTypes);
  }

  public setModalParams(params: ModalParams): void {
    this._modalParams$.next(params);
  }

  public selectProcessLink(processLink: ProcessLink | undefined): void {
    if (!processLink) return;
    this._selectedProcessLink$.next(processLink);
    this.pluginStateService.selectProcessLink(processLink);
    this.setViewModelEnabled(processLink.viewModelEnabled ?? false);
    this._url$.next(processLink.url ?? '');
  }

  public deselectProcessLink(): void {
    this._selectedProcessLink$.next(undefined);
    this.pluginStateService.deselectProcessLink();
  }

  public setEditMode(editMode: ProcessLinkEditMode): void {
    this._processLinkEditMode$.next(editMode);
  }

  public sendProcessLinkUpdateEvent(event: ProcessLinkUpdateEvent): void {
    this._processLinkUpdateEvents$.next(event);
  }

  public sendProcessLinkCreateEvent(event: ProcessLinkCreateEvent): void {
    this._processLinkCreateEvents$.next(event);
  }

  public sendProcessLinkDeleteEvent(event: ProcessLinkDeleteEvent): void {
    this._processLinkDeleteEvents$.next(event);
  }

  private openAvailableProcessLinkTypesSubscription(): void {
    this._availableProcessLinkTypesSubscription = this._availableProcessLinkTypes$.subscribe(
      availableProcessLinkTypes => {
        if (availableProcessLinkTypes.length > 1) {
          this.setInitial();
        }
      }
    );
  }

  private reset(): void {
    this.setAvailableProcessLinkTypes([]);
    this.processLinkStepService.reset();
    this.stopSaving();
    this.buttonService.resetButtons();
    this.clearSelectedProcessLinkType();
    this.deselectProcessLink();
  }
}
