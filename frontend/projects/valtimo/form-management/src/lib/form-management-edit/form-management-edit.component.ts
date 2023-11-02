/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {Component, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {FormioForm} from '@formio/angular';
import {TranslateService} from '@ngx-translate/core';
import {AlertService, PageTitleService, PendingChangesComponent} from '@valtimo/components';
import {ModalService} from 'carbon-components-angular';
import {BehaviorSubject, Subscription} from 'rxjs';
import {first, take} from 'rxjs/operators';
import {FormManagementDuplicateComponent} from '../form-management-duplicate/form-management-duplicate.component';
import {FormManagementService} from '../form-management.service';
import {FormDefinition, ModifyFormDefinitionRequest} from '../models';

@Component({
  selector: 'valtimo-form-management-edit',
  templateUrl: './form-management-edit.component.html',
  styleUrls: ['./form-management-edit.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class FormManagementEditComponent
  extends PendingChangesComponent
  implements OnInit, OnDestroy
{
  public modifiedFormDefinition: FormioForm | null = null;
  public formDefinition: FormDefinition | null = null;

  public readonly showModal$ = new BehaviorSubject<boolean>(false);
  public readonly reloading$ = new BehaviorSubject<boolean>(false);

  private _alertSub: Subscription = Subscription.EMPTY;
  private _formDefinitionId: string | null = null;

  constructor(
    protected readonly modalService: ModalService,
    protected readonly translateService: TranslateService,
    private readonly alertService: AlertService,
    private readonly formManagementService: FormManagementService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    super(modalService, translateService);
  }

  public ngOnInit(): void {
    this.pageTitleService.disableReset();
    this.loadFormDefinition();
    this.checkToOpenUploadModal();
  }

  public ngOnDestroy(): void {
    this._alertSub.unsubscribe();
  }

  public loadFormDefinition(): void {
    this._formDefinitionId = this.route.snapshot.paramMap.get('id');
    this.formManagementService.getFormDefinition(this._formDefinitionId ?? '').subscribe({
      next: formDefinition => {
        this.formDefinition = formDefinition;
        this.pageTitleService.setCustomPageTitle(formDefinition.name);
      },
      error: () => {
        this.alertService.error('Error retrieving Form Definition');
      },
    });
  }

  public modifyFormDefinition(): void {
    if (!this.formDefinition) {
      return;
    }

    this.pendingChanges = false;

    const form = JSON.stringify(
      this.modifiedFormDefinition !== null
        ? this.modifiedFormDefinition
        : this.formDefinition.formDefinition
    );
    const request: ModifyFormDefinitionRequest = {
      id: this.formDefinition.id,
      name: this.formDefinition.name,
      formDefinition: form,
    };
    this.formManagementService.modifyFormDefinition(request).subscribe({
      next: () => {
        this.router.navigate(['/form-management']);
        this.alertService.success('Form deployed');
      },
      error: () => {
        this.alertService.error('Error deploying Form');
      },
    });
  }

  public formBuilderChanged(event): void {
    this.pendingChanges = true;
    this.modifiedFormDefinition = event.form;
  }

  public delete(): void {
    if (!this._alertSub.closed) {
      return;
    }
    const mssg = 'Delete Form?';
    const confirmations = [
      {
        label: 'Cancel',
        class: 'btn btn-default',
        value: false,
      },
      {
        label: 'Delete',
        class: 'btn btn-primary',
        value: true,
      },
    ];
    this.alertService.notification(mssg, confirmations);

    this._alertSub = this.alertService
      .getAlertConfirmChangeEmitter()
      .pipe(first())
      .subscribe(alert => {
        if (alert.confirm === true) {
          this.deleteFormDefinition();
        }
      });
  }

  public deleteFormDefinition(): void {
    if (!this.formDefinition) {
      return;
    }

    this.formManagementService.deleteFormDefinition(this.formDefinition.id).subscribe({
      next: () => {
        this.router.navigate(['/form-management']);
        this.alertService.success('Form deleted');
      },
      error: () => {
        this.alertService.error('Error deleting Form');
      },
    });
  }

  public downloadFormDefinition(): void {
    if (!this.formDefinition) {
      return;
    }

    const file = new Blob([JSON.stringify(this.formDefinition.formDefinition)], {
      type: 'text/json',
    });
    const link = document.createElement('a');
    link.download = `form_${this.formDefinition.name}.json`;
    link.href = window.URL.createObjectURL(file);
    link.click();
    window.URL.revokeObjectURL(link.href);
    link.remove();
  }

  public showUploadModal(): void {
    this.showModal$.next(true);
  }

  public showDuplicateModal(): void {
    this.modalService.create({
      component: FormManagementDuplicateComponent,
      inputs: {
        formToDuplicate: this.formDefinition,
      },
    });
  }

  public setFormDefinition(formDefinition: any): void {
    this.reloading$.next(true);

    const definition = JSON.parse(formDefinition);
    if (!definition?.components) {
      this.reloading$.next(false);
      this.alertService.error('Invalid form.io. Missing JSON field "components".');
      return;
    }

    if (!this.formDefinition) {
      return;
    }

    const components = definition.components;
    const currentDefinition = this.modifiedFormDefinition || this.formDefinition.formDefinition;
    const newDefinition = {...currentDefinition, ...(components && {components})};

    this.modifiedFormDefinition = newDefinition;
    this.formDefinition.formDefinition = newDefinition;

    this.reloading$.next(false);
  }

  protected onConfirmRedirect(): void {
    const cancelButton: HTMLElement | null = document.querySelector('button[ref="cancelButton"]');
    if (!cancelButton) {
      return;
    }

    cancelButton.click();
  }

  private checkToOpenUploadModal(): void {
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      if (params?.upload === 'true') {
        this.showUploadModal();
      }
    });
  }
}
