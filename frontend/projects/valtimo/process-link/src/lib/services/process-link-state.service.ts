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
import {BehaviorSubject, combineLatest, map, Observable, Subject, Subscription} from 'rxjs';
import {
  FormCustomComponentConfig,
  ModalParams,
  ProcessLink,
  ProcessLinkCreateEvent,
  ProcessLinkDeleteEvent,
  ProcessLinkType,
  ProcessLinkUpdateEvent,
} from '../models';
import {PluginStateService} from './plugin-state.service';
import {ProcessLinkButtonService} from './process-link-button.service';
import {ProcessLinkStepService} from './process-link-step.service';
import {FORM_CUSTOM_COMPONENT_TOKEN, UNSUPPORTED_PROCESS_LINK_TYPES_IN_BUILDING_BLOCK} from '../constants';
import {ManagementContext} from '@valtimo/shared';
import {BuildingBlockStateService} from './building-block-state.service';

@Injectable()
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
  private readonly _isEditing$ = new BehaviorSubject<boolean>(false);
  private readonly _processLinkUpdateEvents$ = new Subject<ProcessLinkUpdateEvent>();
  private readonly _processLinkCreateEvents$ = new Subject<ProcessLinkCreateEvent>();
  private readonly _processLinkDeleteEvents$ = new Subject<ProcessLinkDeleteEvent>();
  private readonly _context$ = new BehaviorSubject<ManagementContext>('independent');

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

  public get availableProcessLinkTypes$(): Observable<ProcessLinkType[]> {
    return combineLatest([this._availableProcessLinkTypes$, this._context$]).pipe(
      map(([types, context]) =>
        (!this.formCustomComponentConfig
          ? types.map(type => ({
              ...type,
              enabled: type.processLinkType === 'ui-component' ? false : type.enabled,
            }))
          : types
        )
          .filter(type => type.processLinkType !== 'url')
          .map(type =>
            context === 'buildingBlock' &&
            UNSUPPORTED_PROCESS_LINK_TYPES_IN_BUILDING_BLOCK.includes(type.processLinkType)
              ? {...type, enabled: false}
              : type
          )
      )
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
  public get viewModelEnabled$(): Observable<boolean> {
    return this._viewModelEnabled$.asObservable();
  }
  public get url$(): Observable<string> {
    return this._url$.asObservable();
  }
  public get context$(): Observable<ManagementContext> {
    return this._context$.asObservable();
  }
  public get isEditing$(): Observable<boolean> {
    return this._isEditing$.asObservable();
  }

  private _availableProcessLinkTypesSubscription!: Subscription;
  private _backButtonSubscription!: Subscription;
  private _nextButtonSubscription!: Subscription;

  constructor(
    private readonly processLinkStepService: ProcessLinkStepService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly pluginStateService: PluginStateService,
    private readonly buildingBlockStateService: BuildingBlockStateService,
    @Optional()
    @Inject(FORM_CUSTOM_COMPONENT_TOKEN)
    private readonly formCustomComponentConfig: FormCustomComponentConfig
  ) {
    this.openAvailableProcessLinkTypesSubscription();
    this.openEditModeNavigationSubscriptions();
  }

  public ngOnDestroy(): void {
    this._availableProcessLinkTypesSubscription?.unsubscribe();
    this._backButtonSubscription?.unsubscribe();
    this._nextButtonSubscription?.unsubscribe();
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

  public setContext(context: ManagementContext): void {
    this._context$.next(context);
    this.processLinkStepService.setContext(context);
  }

  public selectProcessLink(processLink: ProcessLink | undefined): void {
    if (!processLink) return;
    this._selectedProcessLink$.next(processLink);
    this._isEditing$.next(true);
    this.pluginStateService.selectProcessLink(processLink);
    this.buildingBlockStateService.setProcessLink(processLink);
    this.setViewModelEnabled(processLink.viewModelEnabled ?? false);
    this._url$.next(processLink.url ?? '');

    // Initialize stepper for editing mode - navigate to last step
    this.processLinkStepService.initializeEditModeSteps(processLink.processLinkType);
    // Set button visibility based on current step position
    this.updateButtonsForCurrentStep();
  }

  public deselectProcessLink(): void {
    this._selectedProcessLink$.next(undefined);
    this.pluginStateService.deselectProcessLink();
    this.resetBuildingBlockState();
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

  private openEditModeNavigationSubscriptions(): void {
    // Handle back button in edit mode
    this._backButtonSubscription = this.buttonService.backButtonClick$.subscribe(() => {
      if (this._isEditing$.getValue()) {
        this.navigateBackInEditMode();
      }
    });

    // Handle next button in edit mode
    this._nextButtonSubscription = this.buttonService.nextButtonClick$.subscribe(() => {
      if (this._isEditing$.getValue()) {
        this.navigateForwardInEditMode();
      }
    });
  }

  private navigateBackInEditMode(): void {
    const navigated = this.processLinkStepService.goToPreviousStep();
    if (navigated) {
      this.updateButtonsForCurrentStep();
    }
  }

  private navigateForwardInEditMode(): void {
    const navigated = this.processLinkStepService.goToNextStep();
    if (navigated) {
      this.updateButtonsForCurrentStep();
    }
  }

  private updateButtonsForCurrentStep(): void {
    const isFirstStep = this.processLinkStepService.isFirstStep();
    const isLastStep = this.processLinkStepService.isLastStep();

    // Back button visibility
    if (isFirstStep) {
      this.buttonService.hideBackButton();
    } else {
      this.buttonService.showBackButton();
    }

    // Next/Save button visibility
    if (isLastStep) {
      this.buttonService.hideNextButton();
      this.buttonService.showSaveButton();
    } else {
      this.buttonService.showNextButton();
      this.buttonService.enableNextButton();
      this.buttonService.hideSaveButton();
    }
  }

  public isBuildingBlockContext(): boolean {
    return this._context$.getValue() === 'buildingBlock';
  }

  private resetBuildingBlockState(): void {
    this.buildingBlockStateService.reset();
  }

  private reset(): void {
    this.setAvailableProcessLinkTypes([]);
    this.processLinkStepService.reset();
    this.stopSaving();
    this.buttonService.resetButtons();
    this.clearSelectedProcessLinkType();
    this.deselectProcessLink();
    this.resetBuildingBlockState();
    this._isEditing$.next(false);
  }
}
