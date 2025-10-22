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
import {Subscription, switchMap} from 'rxjs';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-document',
  templateUrl: './building-block-management-document.component.html',
  styleUrls: ['./building-block-management-document.component.scss'],
  imports: [CommonModule],
})
export class BuildingBlockManagementDocumentComponent implements OnInit, OnDestroy {
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService
  ) {}

  public ngOnInit(): void {
    this.openBuildingBlockDefinitionSubscription();
    this.openLoadingSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private openBuildingBlockDefinitionSubscription(): void {
    this._subscriptions.add(
      this.buildingBlockManagementDetailService.buildingBlockDefinition$
        .pipe(
          switchMap(definition =>
            this.buildingBlockManagementApiService.getBuildingBlockDocumentDefinition(
              definition.key,
              definition.versionTag
            )
          )
        )
        .subscribe(buildingBlockDefinition => {
          console.log(buildingBlockDefinition);
        })
    );
  }

  private openLoadingSubscription(): void {
    this._subscriptions.add(
      this.buildingBlockManagementDetailService.loadingDefinition$.subscribe(loadingDefinition => {
        console.log(loadingDefinition);
      })
    );
  }
}
