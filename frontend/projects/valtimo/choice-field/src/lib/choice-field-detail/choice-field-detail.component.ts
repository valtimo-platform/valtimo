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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {ChoiceFieldService} from '../choice-field.service';
import {ChoiceField} from '@valtimo/contract';
import {AlertService} from '@valtimo/components';
import {Subscription} from 'rxjs';
import {first} from 'rxjs/operators';

@Component({
  selector: 'valtimo-choice-field-detail',
  templateUrl: './choice-field-detail.component.html',
  styleUrls: ['./choice-field-detail.component.css']
})
export class ChoiceFieldDetailComponent implements OnInit, OnDestroy {

  public id: string;
  public form: FormGroup;
  public choiceField: ChoiceField;
  private alertSub: Subscription = Subscription.EMPTY;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private service: ChoiceFieldService,
    private alertService: AlertService
  ) {
    const snapshot = this.route.snapshot.paramMap;
    this.id = snapshot.get('id');
  }

  ngOnInit() {
    this.reset();
  }

  ngOnDestroy() {
    this.alertSub.unsubscribe();
  }

  public get formControls() {
    return this.form.controls;
  }

  private initData(id) {
    this.service.get(id).subscribe(result => {
      this.choiceField = result;
      this.setValues();
    });
  }

  private setValues() {
    if (this.choiceField) {
      // set form values
      this.form.controls.id.setValue(this.choiceField.id);
      this.form.controls.keyName.setValue(this.choiceField.keyName);
      this.form.controls.title.setValue(this.choiceField.title);
    }
  }

  private createFormGroup() {
    return this.formBuilder.group({
      id: new FormControl('', Validators.required),
      keyName: new FormControl('', Validators.required),
      title: new FormControl('', Validators.required)
    });
  }

  public reset() {
    this.form = this.createFormGroup();
    this.initData(this.id);
  }

  public delete() {
    if (!this.alertSub.closed) {
      return;
    }
    // confirm delete
    const mssg = 'Delete choice field?';
    const confirmations = [
      {
        label: 'Cancel',
        class: 'btn btn-default',
        value: false
      },
      {
        label: 'Delete',
        class: 'btn btn-primary',
        value: true
      }
    ];
    this.alertService.notification(mssg, confirmations);
    this.alertSub = this.alertService.getAlertConfirmChangeEmitter()
      .pipe(first())
      .subscribe(alert => {
        if (alert.confirm === true) {
          this.deleteConfirmed();
        }
      });
  }

  private deleteConfirmed() {
    this.service.delete(this.id).subscribe(() => {
      this.router.navigate([`/choice-fields`]);
      this.alertService.success('Choice field has been deleted');
    });
  }

  public onSubmit() {
    this.service.update(this.form.value).subscribe(() => {
      this.reset();
      this.alertService.success('Choice field details have been updated');
    });
  }

}
