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
import {BehaviorSubject, combineLatest, filter, map, Subscription, switchMap, tap} from 'rxjs';
import {FitPageDirective, SchemaEditorComponent} from '@valtimo/components';
import {ButtonModule, IconModule, IconService, LoadingModule} from 'carbon-components-angular';
import {take} from 'rxjs/operators';
import {TranslatePipe} from '@ngx-translate/core';
import {Download16} from '@carbon/icons';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-document',
  templateUrl: './building-block-management-document.component.html',
  styleUrls: ['./building-block-management-document.component.scss'],
  imports: [
    CommonModule,
    ButtonModule,
    IconModule,
    LoadingModule,
    SchemaEditorComponent,
    FitPageDirective,
    TranslatePipe,
  ],
})
export class BuildingBlockManagementDocumentComponent implements OnInit, OnDestroy {
  private readonly _subscriptions = new Subscription();

  private readonly _loadingDocumentDefinition$ = new BehaviorSubject<boolean>(true);

  public readonly loading$ = combineLatest([
    this.buildingBlockManagementDetailService.loadingDefinition$,
    this._loadingDocumentDefinition$,
  ]).pipe(
    map(
      ([loadingDefinition, loadingDocumentDefinition]) =>
        loadingDefinition || loadingDocumentDefinition
    )
  );

  private readonly _documentDefinition$ = new BehaviorSubject<string>('');
  public readonly documentDefinition$ = this._documentDefinition$.pipe(
    filter(model => model !== null)
  );

  public readonly isFinal$ = this.buildingBlockManagementDetailService.isFinal$;

  private _modifiedDefinition: string | null = null;

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Download16]);
  }

  public ngOnInit(): void {
    this.openBuildingBlockDefinitionSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public downloadDefinition(): void {
    this.documentDefinition$.pipe(take(1)).subscribe(definition => {
      const dataString = 'data:text/json;charset=utf-8,' + encodeURIComponent(definition);
      const downloadAnchorElement = document.getElementById('downloadAnchorElement');

      if (!downloadAnchorElement) return;

      downloadAnchorElement.setAttribute('href', dataString);
      downloadAnchorElement.setAttribute(
        'download',
        `${this.buildingBlockManagementDetailService.buildingBlockDefinitionKey}-v${this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag}.json`
      );
      downloadAnchorElement.click();
    });
  }

  public onSaveEvent(): void {
    if (!this._modifiedDefinition) return;

    this._loadingDocumentDefinition$.next(true);

    this.buildingBlockManagementApiService
      .updateBuildingBlockDocumentDefinition(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
        JSON.parse(this._modifiedDefinition)
      )
      .subscribe(res => {
        this.setDocumentDefinitionModel(res);
        this._modifiedDefinition = null;
        this._loadingDocumentDefinition$.next(false);
      });
  }

  public onChangeEvent(event: string): void {
    this._modifiedDefinition = event;
  }

  private openBuildingBlockDefinitionSubscription(): void {
    this._subscriptions.add(
      this.buildingBlockManagementDetailService.buildingBlockDefinition$
        .pipe(
          tap(() => this._loadingDocumentDefinition$.next(true)),
          switchMap(definition =>
            this.buildingBlockManagementApiService.getBuildingBlockDocumentDefinition(
              definition.key,
              definition.versionTag
            )
          ),
          tap(() => this._loadingDocumentDefinition$.next(false))
        )
        .subscribe(buildingBlockDocumentDefinition =>
          this.setDocumentDefinitionModel(buildingBlockDocumentDefinition)
        )
    );
  }

  private setDocumentDefinitionModel(definition: object): void {
    this._documentDefinition$.next(JSON.stringify(definition, null, 2));
  }
}
