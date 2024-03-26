/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {NotificationService} from 'carbon-components-angular';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {DashboardItem} from '../../models';
import {FormBuilder, Validators} from '@angular/forms';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {DashboardManagementService} from '../../services/dashboard-management.service';
import {ConfigurationOutput} from '@valtimo/dashboard';

@Component({
  selector: 'valtimo-edit-dashboard-modal',
  templateUrl: './edit-dashboard-modal.html',
  styleUrls: ['./edit-dashboard-modal.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [NotificationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditDashboardModalComponent implements OnInit {
  @Input() public showModal$: Observable<boolean>;
  @Input() public dashboard: DashboardItem;
  @Output() public saveEvent = new EventEmitter<ConfigurationOutput>();

  public readonly open$ = new BehaviorSubject<boolean>(false);
  public readonly disabled$ = new BehaviorSubject<boolean>(false);
  public readonly editDashboardForm = this.fb.group({
    title: this.fb.control('', [Validators.required]),
    description: this.fb.control('', [Validators.required]),
  });

  public get dashboardTitle() {
    return this.editDashboardForm.get('title');
  }

  public get dashboardDescription() {
    return this.editDashboardForm.get('description');
  }

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
