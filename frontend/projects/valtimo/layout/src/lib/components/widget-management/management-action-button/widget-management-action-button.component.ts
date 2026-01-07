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
  HostBinding,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {DropdownModule, InputModule, ListItem} from 'carbon-components-angular';
import {BehaviorSubject, debounceTime, map, Observable, Subscription, take, tap} from 'rxjs';
import {WidgetAction} from '../../../models';
import {WidgetWizardService} from '../../../services';
import {WidgetManagementProcessSelectorComponent} from '../management-process-selector/widget-management-process-selector.component';

@Component({
  selector: 'valtimo-widget-management-action-button',
  templateUrl: './widget-management-action-button.component.html',
  styleUrl: './widget-management-action-button.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    WidgetManagementProcessSelectorComponent,
    DropdownModule,
    InputModule,
    ReactiveFormsModule,
    TranslateModule,
  ],
})
export class WidgetManagementActionButtonComponent implements OnInit, OnDestroy {
  @HostBinding('class') public readonly class = 'valtimo-widget-management-action-button';

  public readonly $widgetContext = this.widgetWizardService.$widgetContext;
  public readonly buttonType$ = new BehaviorSubject<'process' | 'link'>(
    this.widgetWizardService.$widgetContext() === 'case' ? 'process' : 'link'
  );
  public readonly dropdownItems$: Observable<ListItem[]> = toObservable(
    this.widgetWizardService.$widgetActions
  ).pipe(
    take(1),
    map((actions: WidgetAction[] | undefined) => {
      return [
        {
          content: 'Process',
          id: 'process',
          selected: !!actions?.[0]?.processDefinitionKey || !actions?.[0]?.navigateTo,
        },
        {
          content: 'Link',
          id: 'link',
          selected: !!actions?.[0]?.navigateTo,
        },
      ];
    }),
    tap(dropdownItems => {
      const buttonType = dropdownItems.find(item => item.selected)?.id as 'process' | 'link';
      if (!buttonType) return;

      this.buttonType$.next(buttonType);
    })
  );

  public readonly formGroup = this.fb.group({
    navigateTo: this.fb.control<string>(
      this.widgetWizardService.$widgetActions()?.[0]?.navigateTo ?? '',
      Validators.required
    ),
    name: this.fb.control<string>(
      this.widgetWizardService.$widgetActions()?.[0]?.name ?? '',
      Validators.required
    ),
  });

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly widgetWizardService: WidgetWizardService
  ) {}

  public ngOnInit(): void {
    this.openValueChangeSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onTypeSelected(event: {item: ListItem}): void {
    this.buttonType$.next(event.item.id);
    this.widgetWizardService.$widgetActions.set([]);
    this.formGroup.reset(
      {
        name: '',
        navigateTo: '',
      },
      {emitEvent: false}
    );
  }

  private formContentValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const navigateTo = group.get('navigateTo')?.value?.trim();
      const name = group.get('name')?.value?.trim();

      if ((!navigateTo && !name) || (!!navigateTo && !!name)) {
        group.get('name')?.setErrors(null);
        group.get('navigateTo')?.setErrors(null);
        return null;
      }

      const error: ValidationErrors = {formContentInvalid: true};

      group.get('name')?.setErrors(error);
      group.get('navigateTo')?.setErrors(error);

      return error;
    };
  }

  private openValueChangeSubscription(): void {
    this._subscriptions.add(
      this.formGroup.valueChanges.pipe(debounceTime(100)).subscribe(() => {
        this.widgetWizardService.$widgetContentValid.set(this.formGroup.valid);

        if (!this.formGroup.valid) {
          this.widgetWizardService.$widgetActions.set([]);
          return;
        }

        const action = this.formGroup.getRawValue();

        this.widgetWizardService.$widgetActions.set([
          {
            name: action.name!,
            navigateTo: action.navigateTo!,
          },
        ]);
      })
    );
  }
}
