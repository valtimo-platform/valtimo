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
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {ActivatedRoute, Router, RouterOutlet} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {GlobalNotificationService} from '@valtimo/shared';
import {ButtonModule} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {FormManagementCreateComponent} from '../form-management-create';
import {FormManagementEditComponent} from '../form-management-edit';
import {FormManagementListComponent} from '../form-management-list';

@Component({
  templateUrl: './form-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    FormManagementListComponent,
    FormManagementCreateComponent,
    FormManagementEditComponent,
    RouterOutlet,
  ],
})
export class FormManagementComponent {
  public readonly create$ = new BehaviorSubject<boolean>(false);
  public readonly upload$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly notificationService: GlobalNotificationService,
    private readonly translateService: TranslateService
  ) {}

  public onNavigateToCreateEvent(): void {
    this.create$.next(true);
  }

  public onGoBackFromCreateEvent(): void {
    this.create$.next(false);
    this.upload$.next(false);
  }

  public onFormDefinitionEditEvent(formDefinitionId: string, upload = false): void {
    this.router.navigate([formDefinitionId], {
      relativeTo: this.route,
      queryParams: {...(upload && {upload: true})},
    });
  }

  public onFormDefinitionCreateEvent(formDefinitionId: string): void {
    this.resetNotifications();

    this.notificationService.showToast({
      type: 'success',
      title: this.translateService.instant('formManagement.notifications.created'),
    });

    this.onFormDefinitionEditEvent(formDefinitionId);
  }

  public onFormDefinitionUploadEvent(formDefinitionId: string): void {
    this.resetNotifications();

    this.notificationService.showToast({
      type: 'success',
      title: this.translateService.instant('formManagement.notifications.created'),
    });

    this.onFormDefinitionEditEvent(formDefinitionId, true);
  }

  public onNavigateToUploadEvent(): void {
    this.create$.next(true);
    this.upload$.next(true);
  }

  private resetNotifications(): void {
    this.notificationService
      ?.getNotificationRefs()
      .forEach(ref => this.notificationService.close(ref));
  }
}
