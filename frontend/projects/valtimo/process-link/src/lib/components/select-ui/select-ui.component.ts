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

import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {FormCustomComponentConfig, UIComponentProcessLinkUpdateRequestDto} from '../../models';
import {ListItem} from 'carbon-components-angular';
import {
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
} from '../../services';
import {FORM_CUSTOM_COMPONENT_TOKEN} from '../../constants';

@Component({
  selector: 'valtimo-select-ui',
  templateUrl: './select-ui.component.html',
  styleUrls: ['./select-ui.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectUIComponent implements OnInit, OnDestroy {
  private readonly _formCustomComponentConfig$ = new BehaviorSubject<
    FormCustomComponentConfig | {}
  >({});

  public readonly formCustomComponentListItems$: Observable<Array<ListItem>> = combineLatest([
    this.stateService.selectedProcessLink$,
    this._formCustomComponentConfig$,
  ]).pipe(
    map(([selectedProcessLink, formCustomComponentConfigs]) =>
      Object.keys(formCustomComponentConfigs).map(key => ({
        content: key,
        selected: selectedProcessLink ? selectedProcessLink?.componentKey === key : false,
      }))
    ),
    tap(formCustomComponentListItems => {
      const selectedItem = formCustomComponentListItems.find(item => item.selected);

      if (selectedItem) {
        this.selectCustomComponent(selectedItem);
      }
    })
  );

  private readonly _subscriptions = new Subscription();

  private _selectedCustomComponent: ListItem;

  constructor(
    private readonly stateService: ProcessLinkStateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly processLinkService: ProcessLinkService,
    @Optional()
    @Inject(FORM_CUSTOM_COMPONENT_TOKEN)
    private readonly formCustomComponentConfig: FormCustomComponentConfig
  ) {
    this._formCustomComponentConfig$.next(this.formCustomComponentConfig);
  }

  public ngOnInit(): void {
    this.openBackButtonSubscription();
    this.openSaveButtonSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public selectCustomComponent(selectedCustomComponent: ListItem): void {
    this._selectedCustomComponent = selectedCustomComponent;

    this._selectedCustomComponent.content
      ? this.buttonService.enableSaveButton()
      : this.buttonService.disableSaveButton();
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
    this.stateService.selectedProcessLink$.pipe(take(1)).subscribe(selectedProcessLink => {
      const updateProcessLinkRequest: UIComponentProcessLinkUpdateRequestDto = {
        id: selectedProcessLink.id,
        componentKey: this._selectedCustomComponent.content,
      };

      this.processLinkService.updateProcessLink(updateProcessLinkRequest).subscribe({
        next: () => {
          this.stateService.closeModal();
        },
        error: () => {
          this.stateService.stopSaving();
        },
      });
    });
  }

  private saveNewProcessLink(): void {
    combineLatest([this.stateService.modalParams$, this.stateService.selectedProcessLinkTypeId$])
      .pipe(
        take(1),
        switchMap(([modalParams, processLinkTypeId]) =>
          this.processLinkService.saveProcessLink({
            componentKey: this._selectedCustomComponent.content,
            activityType: modalParams.element.activityListenerType || '',
            processDefinitionId: modalParams.processDefinitionId,
            processLinkType: processLinkTypeId,
            activityId: modalParams.element.id,
          })
        )
      )
      .subscribe({
        next: () => {
          this.stateService.closeModal();
        },
        error: () => {
          this.stateService.stopSaving();
        },
      });
  }
}
