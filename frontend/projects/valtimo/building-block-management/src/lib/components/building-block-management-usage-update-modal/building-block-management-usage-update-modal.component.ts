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
  BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS,
  USAGE_UPDATE_STEP,
  USAGE_UPDATE_STEPS,
} from '../../constants';
import {BuildingBlockManagementService} from '../../services';
import {BuildingBlockUsageUpdateWizardService} from './building-block-usage-update-wizard.service';
import {BuildingBlockUsageUpdateChainsStepComponent} from './usage-update-chains-step/usage-update-chains-step.component';
import {BuildingBlockUsageUpdateDifferencesStepComponent} from './usage-update-differences-step/usage-update-differences-step.component';
import {BuildingBlockUsageUpdateResultComponent} from './usage-update-result/usage-update-result.component';
import {BuildingBlockUsageUpdateReviewStepComponent} from './usage-update-review-step/usage-update-review-step.component';
import {BuildingBlockUsageUpdateSourceStepComponent} from './usage-update-source-step/usage-update-source-step.component';
import {BuildingBlockUsageUpdateTargetStepComponent} from './usage-update-target-step/usage-update-target-step.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-usage-update-modal',
  templateUrl: './building-block-management-usage-update-modal.component.html',
  styleUrls: ['./building-block-management-usage-update-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BuildingBlockUsageUpdateWizardService],
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    ModalModule,
    ProgressIndicatorModule,
    ValtimoCdsModalDirective,
    BuildingBlockUsageUpdateChainsStepComponent,
    BuildingBlockUsageUpdateDifferencesStepComponent,
    BuildingBlockUsageUpdateResultComponent,
    BuildingBlockUsageUpdateReviewStepComponent,
    BuildingBlockUsageUpdateSourceStepComponent,
    BuildingBlockUsageUpdateTargetStepComponent,
  ],
})
export class BuildingBlockManagementUsageUpdateModalComponent implements OnInit, OnDestroy {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS;

  public readonly USAGE_UPDATE_STEP = USAGE_UPDATE_STEP;

  public readonly showModal$ = this.buildingBlockManagementService.showUsageUpdateModal$;

  public readonly $canProceed = this.wizardService.$canProceed;
  public readonly $currentStepIndex = this.wizardService.$currentStepIndex;
  public readonly $executing = this.wizardService.$executing;
  public readonly $result = this.wizardService.$result;
  public readonly $step = this.wizardService.$step;

  public readonly $progressCurrentIndex = computed(() =>
    this.$result() !== null ? USAGE_UPDATE_STEPS.length : this.$currentStepIndex()
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
    private readonly buildingBlockManagementService: BuildingBlockManagementService,
    private readonly translateService: TranslateService,
    private readonly wizardService: BuildingBlockUsageUpdateWizardService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.translateService
        .stream(USAGE_UPDATE_STEPS.map(step => `buildingBlockManagement.usageUpdate.steps.${step}`))
        .subscribe((labels: Record<string, string>) => this._$stepLabels.set(Object.values(labels)))
    );

    this._subscriptions.add(
      this.showModal$.pipe(filter(show => !!show)).subscribe(() => this.wizardService.load())
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
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
