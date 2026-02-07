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
import {CommonModule} from '@angular/common';
import {
  BuildingBlockManagementApiService,
  BuildingBlockManagementDetailService,
} from '../../services';
import {TranslatePipe} from '@ngx-translate/core';
import {FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ReadOnlyDirective, TooltipIconModule} from '@valtimo/components';
import {ButtonModule, InputModule, LayerModule} from 'carbon-components-angular';
import {combineLatest, Subscription} from 'rxjs';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-metadata',
  templateUrl: './building-block-management-metadata.component.html',
  styleUrls: ['./building-block-management-metadata.component.scss'],
  imports: [
    CommonModule,
    TranslatePipe,
    ReactiveFormsModule,
    InputModule,
    TooltipIconModule,
    LayerModule,
    ReadOnlyDirective,
    ButtonModule,
  ],
})
export class BuildingBlockManagementMetadataComponent implements OnInit, OnDestroy {
  public formGroup: FormGroup = this.fb.group({
    name: this.fb.control('', Validators.required),
    key: this.fb.control('', Validators.required),
    description: this.fb.control(''),
  });
  public get name(): FormControl<string> {
    return this.formGroup.get('name') as FormControl<string>;
  }
  public get key(): FormControl<string> {
    return this.formGroup.get('key') as FormControl<string>;
  }
  public get description(): FormControl<string> {
    return this.formGroup.get('description') as FormControl<string>;
  }

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly fb: FormBuilder
  ) {}

  public ngOnInit(): void {
    this.openBuildingBlockDefinitionSubscription();
    this.openLoadingAndFinalSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onSave(): void {
    this.formGroup.disable();

    this.buildingBlockManagementApiService
      .updateBuildingBlockDefinition(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
        this.formGroup.value
      )
      .subscribe(() => {
        this.buildingBlockManagementDetailService.reload();
      });
  }

  private openBuildingBlockDefinitionSubscription(): void {
    this._subscriptions.add(
      this.buildingBlockManagementDetailService.buildingBlockDefinition$.subscribe(
        buildingBlockDefinition => {
          this.formGroup.setValue({
            name: buildingBlockDefinition.name,
            key: buildingBlockDefinition.key,
            description: buildingBlockDefinition.description,
          });
        }
      )
    );
  }

  private openLoadingAndFinalSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this.buildingBlockManagementDetailService.loadingDefinition$,
        this.buildingBlockManagementDetailService.isFinal$,
      ]).subscribe(([loadingDefinition, isFinal]) => {
        if (loadingDefinition) {
          this.formGroup.disable();
        } else if (!isFinal) {
          this.name.enable();
          this.description.enable();
          this.formGroup.markAsPristine();
        }
      })
    );
  }
}
