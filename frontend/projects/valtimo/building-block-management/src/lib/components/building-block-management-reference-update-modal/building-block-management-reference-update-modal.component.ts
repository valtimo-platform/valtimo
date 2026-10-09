/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
  computed,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ButtonModule, ModalModule, ProgressIndicatorModule} from 'carbon-components-angular';
import {filter, Subscription} from 'rxjs';
import {
  BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS,
  REFERENCE_UPDATE_STEP,
  REFERENCE_UPDATE_STEPS,
} from '../../constants';
import {BuildingBlockManagementDetailService} from '../../services';
import {BuildingBlockReferenceUpdateWizardService} from './building-block-reference-update-wizard.service';
import {BuildingBlockReferenceUpdateChainsStepComponent} from './reference-update-chains-step/reference-update-chains-step.component';
import {BuildingBlockReferenceUpdateDifferencesStepComponent} from './reference-update-differences-step/reference-update-differences-step.component';
import {BuildingBlockReferenceUpdateResultComponent} from './reference-update-result/reference-update-result.component';
import {BuildingBlockReferenceUpdateReviewStepComponent} from './reference-update-review-step/reference-update-review-step.component';
import {BuildingBlockReferenceUpdateTargetStepComponent} from './reference-update-target-step/reference-update-target-step.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-reference-update-modal',
  templateUrl: './building-block-management-reference-update-modal.component.html',
  styleUrls: ['./building-block-management-reference-update-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BuildingBlockReferenceUpdateWizardService],
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    ModalModule,
    ProgressIndicatorModule,
    ValtimoCdsModalDirective,
    BuildingBlockReferenceUpdateChainsStepComponent,
    BuildingBlockReferenceUpdateDifferencesStepComponent,
    BuildingBlockReferenceUpdateResultComponent,
    BuildingBlockReferenceUpdateReviewStepComponent,
    BuildingBlockReferenceUpdateTargetStepComponent,
  ],
})
export class BuildingBlockManagementReferenceUpdateModalComponent implements OnInit, OnDestroy {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS;

  public readonly REFERENCE_UPDATE_STEP = REFERENCE_UPDATE_STEP;

  public readonly showModal$ = this.buildingBlockManagementDetailService.showReferenceUpdateModal$;

  public readonly $canProceed = this.wizardService.$canProceed;
  public readonly $currentStepIndex = this.wizardService.$currentStepIndex;
  public readonly $executing = this.wizardService.$executing;
  public readonly $result = this.wizardService.$result;
  public readonly $step = this.wizardService.$step;

  public readonly $progressCurrentIndex = computed(() =>
    this.$result() !== null ? REFERENCE_UPDATE_STEPS.length : this.$currentStepIndex()
  );

  public readonly $progressSteps = computed(() => {
    const currentIndex = this.$currentStepIndex();
    const finished = this.$result() !== null;
    return this._$stepLabels().map((label, index) => ({
      label,
      complete: finished || index < currentIndex,
    }));
  });

  private readonly _$stepLabels = signal<string[]>([]);
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly translateService: TranslateService,
    private readonly wizardService: BuildingBlockReferenceUpdateWizardService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.translateService
        .stream(
          REFERENCE_UPDATE_STEPS.map(
            step => `buildingBlockManagement.referenceUpdate.steps.${step}`
          )
        )
        .subscribe((labels: Record<string, string>) => this._$stepLabels.set(Object.values(labels)))
    );

    this._subscriptions.add(
      this.showModal$.pipe(filter(show => !!show)).subscribe(() =>
        this.wizardService.start({
          key: this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
          versionTag: this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
        })
      )
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.buildingBlockManagementDetailService.hideReferenceUpdateModal();
  }

  public onCloseModal(): void {
    this.wizardService.close();
  }

  public onBackClick(): void {
    this.wizardService.back();
  }

  public onNextClick(): void {
    this.wizardService.next();
  }

  public onExecute(): void {
    this.wizardService.execute();
  }
}
