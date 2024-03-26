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
import {Code16, Development16, WatsonHealthPageScroll16} from '@carbon/icons';
import {ApiTabItem, ApiTabType} from '@valtimo/dossier';
import {IconService} from 'carbon-components-angular';
import {BehaviorSubject, map} from 'rxjs';
import {TabService} from '../../../services';

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
  public readonly tabTypes$ = this.tabService.disableAddTabs$.pipe(
    map(disabled => [
      {
        icon: 'development',
        title: 'dossierManagement.tabManagement.addModal.standardTab',
        type: ApiTabType.STANDARD,
        disabled: disabled.standard,
      },
      {
        icon: 'page-scroll',
        title: 'dossierManagement.tabManagement.addModal.formIOComponent',
        type: ApiTabType.FORMIO,
        disabled: disabled.formIO,
      },
      {
        icon: 'code',
        title: 'dossierManagement.tabManagement.addModal.customComponent',
        type: ApiTabType.CUSTOM,
        disabled: disabled.custom,
      },
    ])
  );

  public readonly form = this.fb.group({
    name: this.fb.control(null),
    key: this.fb.control('', [Validators.required, this.uniqueKeyValidator()]),
    contentKey: this.fb.control('', Validators.required),
  });
  public readonly selectedTabType$ = new BehaviorSubject<ApiTabType | null>(null);

  constructor(
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly tabService: TabService
  ) {
    this.iconService.registerAll([Code16, Development16, WatsonHealthPageScroll16]);
  }

  public addTab(type: ApiTabType): void {
    const {contentKey, key, name} = this.form.getRawValue();

    if (!contentKey || !key) {
      return;
    }
    this.closeModalEvent.emit({name, key, contentKey, type});
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
