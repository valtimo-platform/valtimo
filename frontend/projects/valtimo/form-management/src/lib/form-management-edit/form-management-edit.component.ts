/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {FormManagementService} from '../form-management.service';
import {AlertService} from '@valtimo/components';
import {FormDefinition, ModifyFormDefinitionRequest} from '../models';
import {ActivatedRoute, Router} from '@angular/router';
import {first, take} from 'rxjs/operators';
import {BehaviorSubject, Subscription} from 'rxjs';
import {FormioForm} from '@formio/angular';

@Component({
  selector: 'valtimo-form-management-edit',
  templateUrl: './form-management-edit.component.html',
  styleUrls: ['./form-management-edit.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class FormManagementEditComponent implements OnInit, OnDestroy {
  readonly showModal$ = new BehaviorSubject<boolean>(false);
  readonly reloading$ = new BehaviorSubject<boolean>(false);
  public modifiedFormDefinition: FormioForm = null;
  public formDefinition: FormDefinition | null = null;
  private alertSub: Subscription = Subscription.EMPTY;
  private formDefinitionId: string | null = null;

  constructor(
    private formManagementService: FormManagementService,
    private alertService: AlertService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadFormDefinition();
    this.checkToOpenUploadModal();
  }

  ngOnDestroy() {
    this.alertSub.unsubscribe();
  }

  loadFormDefinition() {
    this.formDefinitionId = this.route.snapshot.paramMap.get('id');
    this.formManagementService.getFormDefinition(this.formDefinitionId).subscribe(
      formDefinition => {
        this.formDefinition = formDefinition;
      },
      () => {
        this.alertService.error('Error retrieving Form Definition');
      }
    );
  }

  modifyFormDefinition() {
    const form = JSON.stringify(
      this.modifiedFormDefinition != null
        ? this.modifiedFormDefinition
        : this.formDefinition.formDefinition
    );
    const request: ModifyFormDefinitionRequest = {
      id: this.formDefinition.id,
      name: this.formDefinition.name,
      formDefinition: form,
    };
    this.formManagementService.modifyFormDefinition(request).subscribe(
      () => {
        this.router.navigate(['/form-management']);
        this.alertService.success('Form deployed');
      },
      err => {
        this.alertService.error('Error deploying Form');
      }
    );
  }

  public formBuilderChanged(event) {
    this.modifiedFormDefinition = event.form;
  }

  public delete() {
    if (!this.alertSub.closed) {
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
    this.alertSub = this.alertService
      .getAlertConfirmChangeEmitter()
      .pipe(first())
      .subscribe(alert => {
        if (alert.confirm === true) {
          this.deleteFormDefinition();
        }
      });
  }

  deleteFormDefinition() {
    this.formManagementService.deleteFormDefinition(this.formDefinition.id).subscribe(
      () => {
        this.router.navigate(['/form-management']);
        this.alertService.success('Form deleted');
      },
      err => {
        this.alertService.error('Error deleting Form');
      }
    );
  }

  downloadFormDefinition() {
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

  showModal() {
    this.showModal$.next(true);
  }

  setFormDefinition(formDefinition: any) {
    this.reloading$.next(true);

    const definition = JSON.parse(formDefinition);
    const components = definition?.formDefinition?.components;
    const currentDefinition = this.modifiedFormDefinition || this.formDefinition.formDefinition;
    const newDefinition = {...currentDefinition, ...(components && {components})};

    this.modifiedFormDefinition = newDefinition;
    this.formDefinition.formDefinition = newDefinition;

    this.reloading$.next(false);
  }

  private checkToOpenUploadModal(): void {
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      if (params?.upload === 'true') {
        this.showModal();
      }
    });
  }
}
