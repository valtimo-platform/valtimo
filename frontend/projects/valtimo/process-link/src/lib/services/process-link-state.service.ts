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

import {Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, map, Observable, Subscription} from 'rxjs';
import {ModalParams, ProcessLink, ProcessLinkType} from '../models';
import {ProcessLinkStepService} from './process-link-step.service';
import {ProcessLinkButtonService} from './process-link-button.service';
import {PluginStateService} from './plugin-state.service';

@Injectable()
export class ProcessLinkStateService implements OnDestroy {
  private readonly _showModal$ = new BehaviorSubject<boolean>(false);
  private readonly _availableProcessLinkTypes$ = new BehaviorSubject<Array<ProcessLinkType>>([]);
  private readonly _elementName$ = new BehaviorSubject<string>('');
  private readonly _selectedProcessLinkTypeId$ = new BehaviorSubject<string>('');
  private readonly _saving$ = new BehaviorSubject<boolean>(false);
  private readonly _modalParams$ = new BehaviorSubject<ModalParams>(undefined);
  private readonly _selectedProcessLink$ = new BehaviorSubject<ProcessLink>(undefined);

  private _availableProcessLinkTypesSubscription!: Subscription;

  get showModal$(): Observable<boolean> {
    return this._showModal$.asObservable();
  }
  get elementName$(): Observable<string> {
    return this._elementName$.asObservable();
  }
  get availableProcessLinkTypes$(): Observable<Array<ProcessLinkType>> {
    return this._availableProcessLinkTypes$.asObservable();
  }
  get hideProgressIndicator$(): Observable<boolean> {
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
  get selectedProcessLinkTypeId$(): Observable<string> {
    return this._selectedProcessLinkTypeId$.asObservable();
  }
  get saving$(): Observable<boolean> {
    return this._saving$.asObservable();
  }
  get modalParams$(): Observable<ModalParams> {
    return this._modalParams$.asObservable();
  }

  get selectedProcessLink$(): Observable<ProcessLink> {
    return this._selectedProcessLink$.asObservable();
  }

  get typeOfSelectedProcessLink$(): Observable<string> {
    return this.selectedProcessLink$.pipe(map(processLink => processLink?.processLinkType || ''));
  }

  constructor(
    private readonly processLinkStepService: ProcessLinkStepService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly pluginStateService: PluginStateService
  ) {
    this.openAvailableProcessLinkTypesSubscription();
  }

  ngOnDestroy(): void {
    this._availableProcessLinkTypesSubscription?.unsubscribe();
  }

  setAvailableProcessLinkTypes(processLinkTypes: Array<ProcessLinkType>): void {
    const hasOneOption = processLinkTypes.length === 1;
    this._availableProcessLinkTypes$.next(processLinkTypes);
    this.processLinkStepService.setHasOneProcessLinkType(hasOneOption);

    if (hasOneOption) {
      this.selectProcessLinkType(processLinkTypes[0].processLinkType, hasOneOption);
    }
  }

  setElementName(name: string): void {
    this._elementName$.next(name);
  }

  showModal(): void {
    this._showModal$.next(true);
  }

  closeModal(): void {
    this._showModal$.next(false);

    setTimeout(() => {
      this.reset();
    }, 240);
  }

  selectProcessLinkType(processLinkTypeId: string, hasOneOption?: boolean): void {
    this._selectedProcessLinkTypeId$.next(processLinkTypeId);
    this.processLinkStepService.setProcessLinkTypeSteps(processLinkTypeId, hasOneOption);
  }

  clearSelectedProcessLinkType(): void {
    this._selectedProcessLinkTypeId$.next('');
  }

  startSaving(): void {
    this._saving$.next(true);
    this.processLinkStepService.disableSteps();
  }

  stopSaving(): void {
    this._saving$.next(false);
    this.processLinkStepService.enableSteps();
  }

  setInitial(): void {
    const availableTypes = this._availableProcessLinkTypes$.getValue();
    this.buttonService.resetButtons();
    this.processLinkStepService.setInitialSteps(availableTypes);
  }

  setModalParams(params: ModalParams): void {
    this._modalParams$.next(params);
  }

  selectProcessLink(processLink: ProcessLink): void {
    this._selectedProcessLink$.next(processLink);
    this.pluginStateService.selectProcessLink(processLink);
  }

  deselectProcessLink(): void {
    this._selectedProcessLink$.next(undefined);
    this.pluginStateService.deselectProcessLink();
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
