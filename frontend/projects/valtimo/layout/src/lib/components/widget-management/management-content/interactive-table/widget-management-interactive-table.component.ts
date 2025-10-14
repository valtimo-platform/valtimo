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
import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
  effect,
} from '@angular/core';
import {FormArray, FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonMultiInputModule, MultiInputValues} from '@valtimo/components';
import {
  ButtonModule,
  CheckboxModule,
  IconModule,
  InputModule,
  LayerModule,
} from 'carbon-components-angular';
import {debounceTime, Subscription} from 'rxjs';
import {WidgetManagementTableComponent} from '../..';
import {IWidgetContentComponent} from '../../../../interfaces';
import {
  WidgetAction,
  WidgetContentProperties,
  WidgetInteractiveTableContent,
} from '../../../../models';
import {WidgetWizardService} from '../../../../services';

@Component({
  templateUrl: './widget-management-interactive-table.component.html',
  styleUrl: './widget-management-interactive-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ButtonModule,
    WidgetManagementTableComponent,
    CheckboxModule,
    IconModule,
    CarbonMultiInputModule,
    InputModule,
    LayerModule,
  ],
})
export class WidgetManagementInteractiveTableComponent
  implements IWidgetContentComponent, OnInit, OnDestroy
{
  @HostBinding('class') public readonly class = 'valtimo-widget-management-interactive-table';
  @Output() public readonly changeValidEvent = new EventEmitter<boolean>();

  public formGroup = this.fb.group({
    canStartCase: this.fb.control<boolean>(
      (this.widgetWizardService.$widgetContent() as WidgetInteractiveTableContent)?.canStartCase ??
        false
    ),
    actions: this.fb.control<MultiInputValues>(
      (this.widgetWizardService.$widgetActions()?.map((action: WidgetAction) => ({
        key: action.name,
        value: action.navigateTo,
      })) as MultiInputValues) ?? []
    ),
    rowClickAction: this.fb.control<string>(''),
  });

  public get actionsControl(): FormArray {
    return this.formGroup.get('actions') as FormArray;
  }

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService
  ) {
    effect(() => {
      if (this.widgetWizardService.$editMode()) this.changeValidEvent.emit(true);
    });
  }

  public ngOnInit(): void {
    this.openActionsSubscription();
    this.openDetailsSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onAddExternalLinkClick(): void {
    this.actionsControl.push(
      this.fb.group({
        key: this.fb.control<string>('', Validators.required),
        value: this.fb.control<string>('', Validators.required),
      })
    );
  }

  public removeExternalLink(index: number): void {
    this.actionsControl.removeAt(index);
  }

  public onTableChangeValidEvent(valid: boolean): void {
    this.changeValidEvent.emit(valid);
  }

  private openActionsSubscription(): void {
    this._subscriptions.add(
      this.actionsControl.valueChanges.pipe(debounceTime(500)).subscribe(() => {
        const valid = !this.actionsControl
          .getRawValue()
          .some(action => !action.key || !action.value);
        this.changeValidEvent.emit(valid);

        if (!valid) return;
        this.widgetWizardService.$widgetActions.set(
          this.actionsControl.getRawValue().map((action: {key: string; value: string}) => ({
            name: action.key,
            navigateTo: action.value,
          }))
        );
      })
    );
  }

  private openDetailsSubscription(): void {
    this._subscriptions.add(
      this.formGroup.valueChanges.pipe(debounceTime(1000)).subscribe(() => {
        const {canStartCase, rowClickAction} = this.formGroup.getRawValue();

        this.widgetWizardService.$widgetContent.update((content: WidgetContentProperties | null) =>
          !content
            ? null
            : ({
                ...content,
                canStartCase,
                rowClickAction: {
                  name: '',
                  navigateTo: rowClickAction,
                },
              } as WidgetInteractiveTableContent)
        );
      })
    );
  }
}
