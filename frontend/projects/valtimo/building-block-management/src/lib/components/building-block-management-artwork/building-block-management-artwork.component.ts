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
  BuildingBlockManagementApiService,
  BuildingBlockManagementDetailService,
} from '../../services';
import {TranslatePipe} from '@ngx-translate/core';
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  ConfirmationModalModule,
  RenderInBodyComponent,
  TooltipIconModule,
} from '@valtimo/components';
import {
  ButtonModule,
  FileUploaderModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  LoadingModule,
} from 'carbon-components-angular';
import {BehaviorSubject, switchMap, tap} from 'rxjs';
import {TrashCan16, Upload16} from '@carbon/icons';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-artwork',
  templateUrl: './building-block-management-artwork.component.html',
  styleUrls: ['./building-block-management-artwork.component.scss'],
  imports: [
    CommonModule,
    TranslatePipe,
    ReactiveFormsModule,
    InputModule,
    TooltipIconModule,
    LayerModule,
    ButtonModule,
    FileUploaderModule,
    LoadingModule,
    IconModule,
    ConfirmationModalModule,
    RenderInBodyComponent,
  ],
})
export class BuildingBlockManagementArtworkComponent {
  public readonly ACCEPTED_FILES: string[] = ['png'];

  public readonly formGroup = this.formBuilder.group({
    file: this.formBuilder.control(new Set<any>(), [Validators.required]),
  });

  public get file(): FormControl<Set<any>> {
    return this.formGroup.get('file') as FormControl<Set<File>>;
  }

  public readonly loadingArtwork$ = new BehaviorSubject<boolean>(true);

  private readonly _refresh$ = new BehaviorSubject<null>(null);

  public readonly artwork$ = this._refresh$.pipe(
    switchMap(() =>
      this.buildingBlockManagementApiService.getBuildingBlockArtwork(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag
      )
    ),
    tap(() => this.loadingArtwork$.next(false))
  );

  public readonly showDeleteConfirmationModal$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly formBuilder: FormBuilder,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Upload16, TrashCan16]);
  }

  public async onSave(): Promise<void> {
    const file = Array.from(this.file.value)[0]?.file;
    const imageBase64 = await this.fileToBase64(file);

    this.formGroup.disable();

    this.buildingBlockManagementApiService
      .createBuildingBlockArtwork(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
        {
          imageBase64,
        }
      )
      .subscribe({
        next: () => {
          this._refresh$.next(null);
          this.formGroup.enable();
        },
        error: () => {
          this.formGroup.enable();
        },
      });
  }

  public onDeleteButtonClick(): void {
    this.showDeleteConfirmationModal$.next(true);
  }

  public onDelete(): void {
    this.buildingBlockManagementApiService
      .deleteBuildingBlockArtwork(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag
      )
      .subscribe(() => {
        this._refresh$.next(null);
      });
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const pureBase64 = result.split(',')[1];
        resolve(pureBase64);
      };
      reader.onerror = error => reject(error);
    });
  }
}
