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
import {ConfigService} from '@valtimo/config';
import {FormService} from '@valtimo/form';
import {BehaviorSubject, combineLatest, map, Observable, Subscription, switchMap, tap} from 'rxjs';
import {take} from 'rxjs/operators';
import {FormDefinitionListItem, FormProcessLinkUpdateRequestDto} from '../../models';
import {
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
} from '../../services';

@Component({
  selector: 'valtimo-select-form',
  templateUrl: './select-form.component.html',
  styleUrls: ['./select-form.component.scss'],
})
export class SelectFormComponent implements OnInit, OnDestroy {
  public formDisplayValue: string = '';
  public formSizeValue: string = '';
  public selectedFormDefinition!: FormDefinitionListItem;

  public readonly saving$ = this.stateService.saving$;
  private readonly formDefinitions$ = this.formService.getAllFormDefinitions();
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
  private readonly _taskPanelToggle = this.configService.featureToggles?.enableTaskPanel;

  constructor(
    private readonly configService: ConfigService,
    private readonly formService: FormService,
    private readonly stateService: ProcessLinkStateService,
    private readonly processLinkService: ProcessLinkService,
    private readonly buttonService: ProcessLinkButtonService
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

    this.selectedFormDefinition
      ? this.buttonService.enableSaveButton()
      : this.buttonService.disableSaveButton();
  }

  public selectedFormDisplayValue(formDisplay: string): void {
    this.formDisplayValue = formDisplay;
  }

  public selectedFormSizeValue(formSize: string): void {
    this.formSizeValue = formSize;
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
          viewModelEnabled,
          ...(this._taskPanelToggle &&
            isUserTask && {
              formDisplayType: this.formDisplayValue,
            }),
          ...(this._taskPanelToggle && isUserTask && {formSize: this.formSizeValue}),
        };

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
      this.stateService.viewModelEnabled$,
      this.isUserTask$,
    ])
      .pipe(
        take(1),
        switchMap(([modalParams, processLinkTypeId, viewModelEnabled, isUserTask]) =>
          this.processLinkService.saveProcessLink({
            formDefinitionId: this.selectedFormDefinition.id,
            activityType: modalParams.element.activityListenerType,
            processDefinitionId: modalParams.processDefinitionId,
            processLinkType: processLinkTypeId,
            activityId: modalParams.element.id,
            viewModelEnabled,
            ...(isUserTask && {
              formDisplayType: this.formDisplayValue,
            }),
            ...(isUserTask && {
              formSize: this.formSizeValue,
            }),
          })
        )
      )
      .subscribe(
        () => {
          this.stateService.closeModal();
        },
        () => {
          this.stateService.stopSaving();
        }
      );
  }
}
