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
import {Component, OnDestroy, OnInit} from '@angular/core';
import {BehaviorSubject, combineLatest, map, Observable, Subscription, tap} from 'rxjs';
import {take} from 'rxjs/operators';
import {
  FormDefinitionListItem,
  FormFlowProcessLinkUpdateRequestDto,
  FormDisplayType,
  FormSize,
  ProcessLinkEditMode,
} from '../../models';
import {
  FormFlowService,
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
} from '../../services';

@Component({
  selector: 'valtimo-select-form-flow',
  templateUrl: './select-form-flow.component.html',
  styleUrls: ['./select-form-flow.component.scss'],
})
export class SelectFormFlowComponent implements OnInit, OnDestroy {
  public formDisplayValue!: FormDisplayType;
  public formSizeValue!: FormSize;
  public selectedFormFlowDefinition!: FormDefinitionListItem;
  public subtitlesValue: string[] = [];
  public readonly saving$ = this.stateService.saving$;
  private readonly formFlowDefinitions$ = this.formFlowService.getFormFlowDefinitions();

  public readonly formFlowDefinitionListItems$: Observable<Array<FormDefinitionListItem>> =
    combineLatest([this.stateService.selectedProcessLink$, this.formFlowDefinitions$]).pipe(
      map(([selectedProcessLink, formFlowDefinitions]) =>
        formFlowDefinitions.map(definition => ({
          content: definition.name,
          id: definition.id,
          selected: selectedProcessLink
            ? selectedProcessLink.formFlowDefinitionId === definition.id
            : false,
        }))
      ),
      tap(formFlowDefinitionListItems => {
        const selectedItem = formFlowDefinitionListItems.find(item => item.selected);

        if (selectedItem) {
          this.selectFormFlowDefinition(selectedItem);
        }
      })
    );

  private _subscriptions = new Subscription();
  private isUserTask$ = new BehaviorSubject<boolean>(false);

  private readonly _DEFAULT_FORM_DISPLAY_TYPE: FormDisplayType = 'panel';
  private readonly _DEFAULT_FORM_DISPLAY_SIZE: FormSize = 'medium';

  constructor(
    private readonly formFlowService: FormFlowService,
    private readonly stateService: ProcessLinkStateService,
    private readonly processLinkService: ProcessLinkService,
    private readonly buttonService: ProcessLinkButtonService
  ) {}

  ngOnInit(): void {
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

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public selectedFormDisplayValue(formDisplay: FormDisplayType): void {
    this.formDisplayValue = formDisplay;
  }

  public selectedFormSizeValue(formSize: FormSize): void {
    this.formSizeValue = formSize;
  }

  public selectFormFlowDefinition(formFlowDefinition: FormDefinitionListItem): void {
    this.selectedFormFlowDefinition = formFlowDefinition?.id ? formFlowDefinition : null;

    this.selectedFormFlowDefinition
      ? this.buttonService.enableSaveButton()
      : this.buttonService.disableSaveButton();
  }

  public selectedSubtitlesValue(subtitles: string[]): void {
    this.subtitlesValue = subtitles;
  }

  private openBackButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.backButtonClick$.subscribe(() => {
        this.stateService.setInitial();
      })
    );
  }

  private openSaveButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.saveButtonClick$.subscribe(() => {
        this.stateService.startSaving();
        this.saveFormFlowLink();
      })
    );
  }

  private saveFormFlowLink(): void {
    this.stateService.selectedProcessLink$.pipe(take(1)).subscribe(selectedProcessLink => {
      if (selectedProcessLink) {
        this.updateProcessLink();
      } else {
        this.saveNewProcessLink();
      }
    });
  }

  private updateProcessLink(): void {
    combineLatest(this.stateService.selectedProcessLink$, this.isUserTask$)
      .pipe(take(1))
      .subscribe(([selectedProcessLink, isUserTask]) => {
        const updateProcessLinkRequest: FormFlowProcessLinkUpdateRequestDto = {
          id: selectedProcessLink.id,
          formFlowDefinitionId: this.selectedFormFlowDefinition.id,
          activityId: selectedProcessLink.activityId,
          ...(isUserTask && {
            formDisplayType: this.formDisplayValue || this._DEFAULT_FORM_DISPLAY_TYPE,
          }),
          ...(isUserTask && {formSize: this.formSizeValue || this._DEFAULT_FORM_DISPLAY_SIZE}),
          ...(isUserTask && {subtitles: this.subtitlesValue}),
        };

        if (this.stateService.processLinkEditMode === ProcessLinkEditMode.EMIT_EVENTS) {
          this.stateService.sendProcessLinkUpdateEvent(updateProcessLinkRequest);
          return;
        }

        this.processLinkService.updateProcessLink(updateProcessLinkRequest).subscribe(
          () => {
            this.stateService.closeModal();
          },
          () => {
            this.stateService.stopSaving();
          }
        );
      });
  }

  private saveNewProcessLink(): void {
    combineLatest([
      this.stateService.modalParams$,
      this.stateService.selectedProcessLinkTypeId$,
      this.isUserTask$,
    ])
      .pipe(take(1))
      .subscribe(([modalParams, processLinkTypeId, isUserTask]) => {
        const createRequest = {
          formFlowDefinitionId: this.selectedFormFlowDefinition.id,
          activityType: modalParams.element.activityListenerType,
          processDefinitionId: modalParams.processDefinitionId,
          processLinkType: processLinkTypeId,
          activityId: modalParams.element.id,
          ...(isUserTask && {
            formDisplayType: this.formDisplayValue || this._DEFAULT_FORM_DISPLAY_TYPE,
          }),
          ...(isUserTask && {formSize: this.formSizeValue || this._DEFAULT_FORM_DISPLAY_SIZE}),
          ...(isUserTask && {subtitles: this.subtitlesValue}),
        };

        if (this.stateService.processLinkEditMode === ProcessLinkEditMode.EMIT_EVENTS) {
          this.stateService.sendProcessLinkCreateEvent(createRequest);
          return;
        }

        this.processLinkService.saveProcessLink(createRequest).subscribe({
          next: () => {
            this.stateService.closeModal();
          },
          error: () => {
            this.stateService.stopSaving();
          },
        });
      });
  }
}
