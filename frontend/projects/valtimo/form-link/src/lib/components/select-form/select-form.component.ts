/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {FormService} from '@valtimo/form';
import {combineLatest, map, Observable, Subscription, switchMap} from 'rxjs';
import {ProcessLinkService, ProcessLinkState2Service} from '../../services';
import {FormDefinitionListItem} from '../../models';
import {take} from 'rxjs/operators';

@Component({
  selector: 'valtimo-select-form',
  templateUrl: './select-form.component.html',
  styleUrls: ['./select-form.component.scss'],
})
export class SelectFormComponent implements OnInit, OnDestroy {
  public readonly saving$ = this.stateService.saving$;
  private readonly formDefinitions$ = this.formService.getAllFormDefinitions();
  public readonly formDefinitionListItems$: Observable<Array<FormDefinitionListItem>> =
    this.formDefinitions$.pipe(
      map(formDefinitions =>
        formDefinitions.map(definition => ({
          content: definition.name,
          id: definition.id,
          selected: false,
        }))
      )
    );

  private _selectedFormDefinition!: FormDefinitionListItem;
  private _subscriptions = new Subscription();

  constructor(
    private readonly formService: FormService,
    private readonly stateService: ProcessLinkState2Service,
    private readonly processLinkService: ProcessLinkService
  ) {}

  ngOnInit(): void {
    this.openBackButtonSubscription();
    this.openSaveButtonSubscription();
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  selectFormDefinition(formDefinition: FormDefinitionListItem): void {
    if (typeof formDefinition === 'object' && formDefinition.id) {
      this._selectedFormDefinition = formDefinition;
      this.stateService.enableSaveButton();
    } else {
      this._selectedFormDefinition = null;
      this.stateService.disableSaveButton();
    }
  }

  private openBackButtonSubscription(): void {
    this._subscriptions.add(
      this.stateService.backButtonClick$.subscribe(() => {
        this.stateService.setInitial();
      })
    );
  }

  private openSaveButtonSubscription(): void {
    this._subscriptions.add(
      this.stateService.saveButtonClick$.subscribe(() => {
        this.stateService.startSaving();
        this.saveFormLink();
      })
    );
  }

  private saveFormLink(): void {
    combineLatest([this.stateService.modalParams$, this.stateService.selectedProcessLinkTypeId$])
      .pipe(
        take(1),
        switchMap(([modalParams, processLinkTypeId]) =>
          this.processLinkService.saveProcessLink({
            formDefinitionId: this._selectedFormDefinition.id,
            activityType: modalParams.element.activityListenerType,
            processDefinitionId: modalParams.processDefinitionId,
            processLinkType: processLinkTypeId,
            activityId: modalParams.element.id,
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
