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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {DASHBOARD_MANAGEMENT_TEST_IDS} from '../../constants/dashboard-management.test-ids';
import {DashboardItem} from '../../models';
import {FormBuilder, Validators} from '@angular/forms';
import {
  CARBON_CONSTANTS,
  SelectItem,
  WIDGET_LAYOUT_TRANSLATION_KEYS,
  WIDGET_LAYOUT_VALUES,
  WidgetLayout,
} from '@valtimo/components';
import {DashboardManagementService} from '../../services/dashboard-management.service';
import {ConfigurationOutput} from '@valtimo/dashboard';

@Component({
  selector: 'valtimo-edit-dashboard-modal',
  templateUrl: './edit-dashboard-modal.html',
  styleUrls: ['./edit-dashboard-modal.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EditDashboardModalComponent implements OnInit {
  protected readonly testIds = DASHBOARD_MANAGEMENT_TEST_IDS;
  @Input() public showModal$: Observable<boolean>;
  @Input() public dashboard: DashboardItem;
  @Output() public saveEvent = new EventEmitter<ConfigurationOutput>();

  public readonly open$ = new BehaviorSubject<boolean>(false);
  public readonly disabled$ = new BehaviorSubject<boolean>(false);
  public readonly editDashboardForm = this.fb.group({
    title: this.fb.control('', [Validators.required]),
    description: this.fb.control('', [Validators.required]),
    widgetLayout: this.fb.control<WidgetLayout>(WidgetLayout.MUURI_GAP_FREE),
  });

  public get dashboardTitle() {
    return this.editDashboardForm.get('title');
  }

  public get dashboardDescription() {
    return this.editDashboardForm.get('description');
  }

  public readonly widgetLayoutSelectItems: SelectItem[] = WIDGET_LAYOUT_VALUES.map(value => ({
    id: value,
    translationKey: WIDGET_LAYOUT_TRANSLATION_KEYS[value],
  }));

  private _openSubscription!: Subscription;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dashboardManagementService: DashboardManagementService
  ) {}

  public ngOnInit(): void {
    this.openOpenSubscription();
  }

  public closeModal(): void {
    this.open$.next(false);

    setTimeout(() => {
      this.editDashboardForm.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public saveDashboard(): void {
    this.disable();

    this.dashboardManagementService
      .updateDashboard({
        description: this.dashboardDescription.value,
        title: this.dashboardTitle.value,
        key: this.dashboard.key,
        widgetLayout: this.editDashboardForm.get('widgetLayout').value ?? WidgetLayout.MUURI_GAP_FREE,
      })
      .subscribe(() => {
        this.saveEvent.emit();
        this.closeModal();
      });
  }

  private setEditDashboardForm(): void {
    if (this.dashboard) {
      this.dashboardTitle?.setValue(this.dashboard.title);
      this.dashboardDescription?.setValue(this.dashboard.description);
      this.editDashboardForm
        .get('widgetLayout')
        ?.setValue(this.dashboard.widgetLayout ?? WidgetLayout.MUURI_GAP_FREE);
    }

    this.enable();
  }

  private openOpenSubscription(): void {
    this._openSubscription = this.showModal$.subscribe(show => {
      this.setEditDashboardForm();
      this.open$.next(show);
    });
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enable(): void {
    this.disabled$.next(false);
  }
}
