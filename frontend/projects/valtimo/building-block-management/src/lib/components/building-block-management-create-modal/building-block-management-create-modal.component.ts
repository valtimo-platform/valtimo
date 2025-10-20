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
import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  ButtonModule,
  IconModule,
  InputModule,
  LayerModule,
  ModalModule,
  TooltipModule,
} from 'carbon-components-angular';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';
import {
  AutoKeyInputComponent,
  runAfterCarbonModalClosed,
  TooltipIconModule,
  ValtimoCdsModalDirective,
} from '@valtimo/components';
import {BuildingBlockManagementService} from '../../services/building-block-management.service';
import {BuildingBlockManagementApiService} from '../../services';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-create-modal',
  templateUrl: './building-block-management-create-modal.component.html',
  styleUrls: ['./building-block-management-create-modal.component.scss'],
  imports: [
    CommonModule,
    ModalModule,
    ButtonModule,
    IconModule,
    FormsModule,
    InputModule,
    ReactiveFormsModule,
    TooltipModule,
    TranslatePipe,
    ValtimoCdsModalDirective,
    AutoKeyInputComponent,
    LayerModule,
    TooltipIconModule,
  ],
})
export class BuildingBlockManagementCreateModalComponent {
  public readonly showModal$ = this.buildingBlockManagementService.showCreateModal$;
  public readonly usedKeys$ = this.buildingBlockManagementService.usedKeys$;

  public formGroup: FormGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
    key: this.fb.control('', [Validators.required, Validators.pattern('[A-Za-z0-9-]*')]),
    versionTag: this.fb.control('', Validators.required),
    description: this.fb.control(''),
  });
  public get title(): FormControl<string> {
    return this.formGroup.get('title') as FormControl<string>;
  }
  public get key(): FormControl<string> {
    return this.formGroup.get('key') as FormControl<string>;
  }
  public get versionTag(): FormControl<string> {
    return this.formGroup.get('versionTag') as FormControl<string>;
  }
  public get description(): FormControl<string> {
    return this.formGroup.get('description') as FormControl<string>;
  }

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly buildingBlockManagementService: BuildingBlockManagementService,
    private readonly fb: FormBuilder
  ) {}

  public onCloseModal(): void {
    this.buildingBlockManagementService.hideCreateModal();
    this.resetForm();
  }

  public onSave(): void {
    this.formGroup.disable();

    this.buildingBlockManagementApiService
      .createBuildingBlockDefinition(this.formGroup.value)
      .subscribe(() => {
        this.buildingBlockManagementService.hideCreateModal();
        this.resetForm();
      });
  }

  private resetForm(): void {
    runAfterCarbonModalClosed(() => {
      this.formGroup.reset();
      this.formGroup.enable();
    });
  }
}
