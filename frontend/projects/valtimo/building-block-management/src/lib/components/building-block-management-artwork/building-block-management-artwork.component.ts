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
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {ReadOnlyDirective, TooltipIconModule} from '@valtimo/components';
import {
  ButtonModule,
  FileUploaderModule,
  InputModule,
  LayerModule,
  LoadingModule,
} from 'carbon-components-angular';
import {BehaviorSubject, Subscription, tap} from 'rxjs';

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
    ReadOnlyDirective,
    ButtonModule,
    FileUploaderModule,
    LoadingModule,
  ],
})
export class BuildingBlockManagementArtworkComponent implements OnInit, OnDestroy {
  public readonly ACCEPTED_FILES: string[] = ['png'];

  public readonly formGroup = this.formBuilder.group({
    file: this.formBuilder.control(new Set<any>(), [Validators.required]),
  });

  public get file(): FormControl<Set<any>> {
    return this.formGroup.get('file') as FormControl<Set<File>>;
  }

  private readonly _subscriptions = new Subscription();

  public readonly loadingArtwork$ = new BehaviorSubject<boolean>(true);

  public readonly artwork$ = this.buildingBlockManagementApiService
    .getBuildingBlockArtwork(
      this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
      this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag
    )
    .pipe(tap(() => this.loadingArtwork$.next(false)));

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly formBuilder: FormBuilder
  ) {}

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
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
      .subscribe(() => {
        this.buildingBlockManagementDetailService.reload();
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
  //
  // private openBuildingBlockDefinitionSubscription(): void {
  //   this._subscriptions.add(
  //     this.buildingBlockManagementDetailService.buildingBlockDefinition$.subscribe(
  //       buildingBlockDefinition => {
  //         this.formGroup.setValue({
  //           name: buildingBlockDefinition.name,
  //           key: buildingBlockDefinition.key,
  //           description: buildingBlockDefinition.description,
  //         });
  //       }
  //     )
  //   );
  // }
  //
  // private openLoadingSubscription(): void {
  //   this._subscriptions.add(
  //     this.buildingBlockManagementDetailService.loadingDefinition$.subscribe(loadingDefinition => {
  //       if (loadingDefinition) {
  //         this.formGroup.disable();
  //       } else {
  //         this.name.enable();
  //         this.description.enable();
  //         this.formGroup.markAsPristine();
  //       }
  //     })
  //   );
  // }
}
