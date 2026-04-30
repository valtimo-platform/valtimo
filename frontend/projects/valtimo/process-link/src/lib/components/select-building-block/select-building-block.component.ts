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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Component, OnDestroy, OnInit} from '@angular/core';
import {
  BuildingBlockStateService,
  ProcessLinkBuildingBlockApiService,
  ProcessLinkButtonService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';
import {BuildingBlockDefinitionDto} from '@valtimo/shared';
import {catchError, filter, map, Observable, of, shareReplay, Subscription, tap, withLatestFrom} from 'rxjs';

@Component({
  standalone: false,
  selector: 'valtimo-select-building-block',
  templateUrl: './select-building-block.component.html',
  styleUrls: ['./select-building-block.component.scss'],
})
export class SelectBuildingBlockComponent implements OnInit, OnDestroy {
  public readonly buildingBlocks$: Observable<Array<BuildingBlockDefinitionDto>> =
    this.processLinkBuildingBlockApiService
      .getBuildingBlockDefinitions({includeArtwork: true})
      .pipe(
        map(definitions => [...(definitions ?? [])]),
        map(definitions =>
          definitions.sort((a, b) => (a.name || a.key).localeCompare(b.name || b.key))
        ),
        catchError(() => of([])),
        tap(() => {
          this.loading = false;
        }),
        shareReplay(1)
      );

  public loading = true;
  public selectedKey: string | null = null;

  private readonly subscriptions = new Subscription();
  private buildingBlocks: Array<BuildingBlockDefinitionDto> = [];

  constructor(
    private readonly processLinkBuildingBlockApiService: ProcessLinkBuildingBlockApiService,
    private readonly stateService: ProcessLinkStateService,
    private readonly buildingBlockStateService: BuildingBlockStateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly stepService: ProcessLinkStepService
  ) {}

  public ngOnInit(): void {
    this.buttonService.disableNextButton();
    this.subscriptions.add(
      this.buildingBlocks$.subscribe(definitions => {
        this.buildingBlocks = definitions ?? [];

        if (this.selectedKey) {
          this.stepService.updateBuildingBlockSelectionStepLabel(
            this.getDefinitionLabel(this.findDefinitionByKey(this.selectedKey))
          );
        }
      })
    );

    this.subscriptions.add(
      this.buildingBlockStateService.definitionKey$.subscribe(key => {
        this.selectedKey = key;
        if (key) {
          this.stepService.updateBuildingBlockSelectionStepLabel(
            this.getDefinitionLabel(this.findDefinitionByKey(key))
          );
          this.buttonService.enableNextButton();
        } else {
          this.buttonService.disableNextButton();
        }
      })
    );

    this.subscriptions.add(
      this.buttonService.backButtonClick$
        .pipe(
          withLatestFrom(this.stateService.isEditing$),
          filter(([, isEditing]) => !isEditing)
        )
        .subscribe(() => {
          this.stateService.setInitial();
        })
    );

    this.subscriptions.add(
      this.buttonService.nextButtonClick$
        .pipe(
          withLatestFrom(this.stateService.isEditing$),
          filter(([, isEditing]) => !isEditing)
        )
        .subscribe(() => {
          this.stepService.setConfigureBuildingBlockPluginsStep(
            this.getDefinitionLabel(this.findDefinitionByKey(this.selectedKey))
          );
        })
    );
  }

  public ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  public onSelectionChange(event: {value: BuildingBlockDefinitionDto}): void {
    const definition = event?.value;
    this.selectedKey = definition?.key ?? null;
    this.buildingBlockStateService.setDefinitionKey(definition?.key ?? null);
    this.stepService.updateBuildingBlockSelectionStepLabel(this.getDefinitionLabel(definition));
    if (definition?.key) {
      this.buttonService.enableNextButton();
    } else {
      this.buttonService.disableNextButton();
    }
  }

  public trackByKey(_: number, definition: BuildingBlockDefinitionDto): string {
    return definition.key;
  }

  private findDefinitionByKey(key: string | null): BuildingBlockDefinitionDto | undefined {
    if (!key) return undefined;
    return this.buildingBlocks.find(definition => definition.key === key);
  }

  private getDefinitionLabel(definition?: BuildingBlockDefinitionDto): string {
    if (!definition) return '';
    const name = definition.name || definition.key;
    return name;
  }
}
