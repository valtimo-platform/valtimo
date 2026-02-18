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
import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {
  BuildingBlockManagementParams,
  CaseManagementParams,
  getBuildingBlockManagementRouteParams,
  getCaseManagementRouteParams,
} from '@valtimo/shared';
import {FormDefinitionOption, FormService} from '@valtimo/form';
import {BehaviorSubject, combineLatest, map, mergeMap, Observable, Subscription, tap} from 'rxjs';
import {filter, take, withLatestFrom} from 'rxjs/operators';
import {
  FormDefinitionListItem,
  FormDisplayType,
  FormProcessLinkUpdateRequestDto,
  FormSize,
} from '../../models';
import {
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
} from '../../services';

@Component({
  standalone: false,
  selector: 'valtimo-select-form',
  templateUrl: './select-form.component.html',
  styleUrls: ['./select-form.component.scss'],
})
export class SelectFormComponent implements OnInit, OnDestroy {
  public formDisplayValue!: FormDisplayType;
  public formSizeValue!: FormSize;
  public subtitlesValue: string[] = [];
  public selectedFormDefinition!: FormDefinitionListItem;

  public readonly saving$ = this.stateService.saving$;
  public readonly caseDefinitionId$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route);
  public readonly buildingBlockDefinitionId$: Observable<
    BuildingBlockManagementParams | undefined
  > = getBuildingBlockManagementRouteParams(this.route);

  private readonly formDefinitions$: Observable<Array<FormDefinitionOption>> = combineLatest([
    this.caseDefinitionId$,
    this.buildingBlockDefinitionId$,
  ]).pipe(
    mergeMap(([caseDefinitionId, buildingBlockDefinitionId]) => {
      if (!!buildingBlockDefinitionId) {
        return this.formService.getAllFormDefinitionsForBuildingBlock(
          buildingBlockDefinitionId.buildingBlockDefinitionKey,
          buildingBlockDefinitionId.buildingBlockDefinitionVersionTag
        );
      }
      if (!!caseDefinitionId) {
        return this.formService.getAllFormDefinitionsForCaseDefinition(
          caseDefinitionId.caseDefinitionKey,
          caseDefinitionId.caseDefinitionVersionTag
        );
      }
      return this.formService.getAllUnlinkedFormDefinitions();
    })
  );

  public readonly formDefinitionListItems$: Observable<Array<FormDefinitionListItem>> =
    combineLatest([this.stateService.selectedProcessLink$, this.formDefinitions$]).pipe(
      map(([selectedProcessLink, formDefinitions]) =>
        formDefinitions.map(definition => ({
          content: definition.name,
          id: definition.id,
          selected: selectedProcessLink
            ? selectedProcessLink.formDefinitionId === definition.id
            : false,
        }))
      ),
      tap(formDefinitionListItems => {
        const selectedItem = formDefinitionListItems.find(item => item.selected);

        if (selectedItem) {
          this.selectFormDefinition(selectedItem);
        }
      })
    );

  private _subscriptions = new Subscription();
  private isUserTask$ = new BehaviorSubject<boolean>(false);

  private readonly _DEFAULT_FORM_DISPLAY_TYPE: FormDisplayType = 'panel';
  private readonly _DEFAULT_FORM_DISPLAY_SIZE: FormSize = 'medium';

  constructor(
    private readonly formService: FormService,
    private readonly stateService: ProcessLinkStateService,
    private readonly processLinkService: ProcessLinkService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly route: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    this.openBackButtonSubscription();
    this.openSaveButtonSubscription();
    this._subscriptions.add(
      combineLatest([
        this.stateService.selectedProcessLink$,
        this.stateService.modalParams$,
      ]).subscribe(([selectedProcessLink, modalParams]) => {
        if (selectedProcessLink) {
          this.formDisplayValue = selectedProcessLink.formDisplayType;
          this.formSizeValue = selectedProcessLink.formSize;
        }

        this.isUserTask$.next(modalParams?.element?.type === 'bpmn:UserTask');
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public selectFormDefinition(formDefinition: FormDefinitionListItem): void {
    this.selectedFormDefinition = formDefinition?.id ? formDefinition : null;

    if (this.selectedFormDefinition) this.buttonService.enableSaveButton();
    else this.buttonService.disableSaveButton();
  }

  public selectedFormDisplayValue(formDisplay: FormDisplayType): void {
    this.formDisplayValue = formDisplay;
  }

  public selectedFormSizeValue(formSize: FormSize): void {
    this.formSizeValue = formSize;
  }

  public selectedSubtitlesValue(subtitles: string[]): void {
    this.subtitlesValue = subtitles;
  }

  private openBackButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.backButtonClick$
        .pipe(
          withLatestFrom(this.stateService.isEditing$),
          filter(([, isEditing]) => !isEditing)
        )
        .subscribe(() => {
          this.stateService.setInitial();
        })
    );
  }

  private openSaveButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.saveButtonClick$.subscribe(() => {
        this.stateService.startSaving();
        this.saveProcessLink();
      })
    );
  }

  private saveProcessLink(): void {
    this.stateService.selectedProcessLink$.pipe(take(1)).subscribe(selectedProcessLink => {
      if (selectedProcessLink) {
        this.updateProcessLink();
      } else {
        this.saveNewProcessLink();
      }
    });
  }

  private updateProcessLink(): void {
    combineLatest([
      this.stateService.selectedProcessLink$,
      this.stateService.viewModelEnabled$,
      this.isUserTask$,
    ])
      .pipe(take(1))
      .subscribe(([selectedProcessLink, viewModelEnabled, isUserTask]) => {
        const updateProcessLinkRequest: FormProcessLinkUpdateRequestDto = {
          id: selectedProcessLink.id,
          formDefinitionId: this.selectedFormDefinition.id,
          activityId: selectedProcessLink.activityId,
          viewModelEnabled,
          ...(isUserTask && {
            formDisplayType: this.formDisplayValue || this._DEFAULT_FORM_DISPLAY_TYPE,
          }),
          ...(isUserTask && {formSize: this.formSizeValue || this._DEFAULT_FORM_DISPLAY_TYPE}),
          ...(isUserTask && {subtitles: this.subtitlesValue}),
        };

        this.stateService.sendProcessLinkUpdateEvent(updateProcessLinkRequest);
      });
  }

  private saveNewProcessLink(): void {
    combineLatest([
      this.stateService.modalParams$,
      this.stateService.selectedProcessLinkTypeId$,
      this.stateService.viewModelEnabled$,
      this.isUserTask$,
    ])
      .pipe(take(1))
      .subscribe(([modalParams, processLinkTypeId, viewModelEnabled, isUserTask]) => {
        const createRequest = {
          formDefinitionId: this.selectedFormDefinition.id,
          activityType: modalParams.element.activityListenerType,
          processDefinitionId: modalParams.processDefinitionId,
          processLinkType: processLinkTypeId,
          activityId: modalParams.element.id,
          viewModelEnabled,
          ...(isUserTask && {
            formDisplayType: this.formDisplayValue || this._DEFAULT_FORM_DISPLAY_TYPE,
          }),
          ...(isUserTask && {
            formSize: this.formSizeValue || this._DEFAULT_FORM_DISPLAY_SIZE,
          }),
          ...(isUserTask && {
            subtitles: this.subtitlesValue,
          }),
        };

        this.stateService.sendProcessLinkCreateEvent(createRequest);
      });
  }
}
