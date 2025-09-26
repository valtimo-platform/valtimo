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
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {Code16, Development16, TableBuilt16, WatsonHealthPageScroll16} from '@carbon/icons';
import {ApiTabItem, ApiTabType, TabSelectItem} from '@valtimo/dossier';
import {IconService} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';
import {TabService} from '../../../services';
import {ConfigService} from '@valtimo/config';

@Component({
  selector: 'valtimo-dossier-management-add-tab-modal',
  templateUrl: './dossier-management-add-tab-modal.component.html',
  styleUrls: ['./dossier-management-add-tab-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class DossierManagementAddTabModalComponent {
  @Input() documentDefinitionName: string;
  @Input() open = false;

  @Output() closeModalEvent = new EventEmitter<Partial<ApiTabItem> | null>();

  public readonly ApiTabType = ApiTabType;

  public readonly tabTypes$: Observable<TabSelectItem[]> = combineLatest([
    this.tabService.disableAddTabs$,
    this.configService.featureToggles$,
  ]).pipe(
    map(([disabled, featureToggles]) => [
      {
        icon: 'development',
        title: 'dossierManagement.tabManagement.addModal.standardTab',
        type: ApiTabType.STANDARD,
        disabled: disabled.standard,
        disabledTooltipTranslationKey:
          'dossierManagement.tabManagement.addModal.standardTabDisabled',
      },
      {
        icon: 'page-scroll',
        title: 'dossierManagement.tabManagement.addModal.formIOComponent',
        type: ApiTabType.FORMIO,
        disabled: disabled.formIO,
        disabledTooltipTranslationKey:
          'dossierManagement.tabManagement.addModal.formIOComponentDisabled',
      },
      {
        icon: 'code',
        title: 'dossierManagement.tabManagement.addModal.customComponent',
        type: ApiTabType.CUSTOM,
        disabled: disabled.custom,
        disabledTooltipTranslationKey:
          'dossierManagement.tabManagement.addModal.customComponentDisabled',
      },
      {
        icon: 'table--built',
        title: 'dossierManagement.tabManagement.addModal.widgetsComponent',
        type: ApiTabType.WIDGETS,
        disabled: disabled.widgets,
      },
    ])
  );

  public readonly form = this.fb.group({
    name: this.fb.control(null),
    key: this.fb.control('', [Validators.required, this.uniqueKeyValidator()]),
    contentKey: this.fb.control('', Validators.required),
    showTasks: this.fb.control(false, Validators.required),
  });
  public readonly selectedTabType$ = new BehaviorSubject<ApiTabType | null>(null);

  constructor(
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly tabService: TabService,
    private readonly configService: ConfigService
  ) {
    this.iconService.registerAll([Code16, Development16, TableBuilt16, WatsonHealthPageScroll16]);
  }

  public addTab(type: ApiTabType): void {
    let {contentKey, key, name, showTasks} = this.form.getRawValue();
    if (!contentKey) {
      contentKey = '-';
    }

    if (!key) {
      return;
    }
    this.closeModalEvent.emit({name, key, contentKey, type, showTasks});
  }

  public backClick(): void {
    this.resetModal();
  }

  public onCloseModal(): void {
    this.closeModalEvent.emit(null);
    this.resetModal();
  }

  public onTabTypeSelect(type: ApiTabType): void {
    this.selectedTabType$.next(type);
  }

  private resetModal(): void {
    this.selectedTabType$.next(null);
    this.form.reset();
  }

  private uniqueKeyValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null =>
      this.tabService.configuredTabKeys.every((key: string) => key !== control.value)
        ? null
        : {uniqueKey: {value: control.value}};
  }
}
