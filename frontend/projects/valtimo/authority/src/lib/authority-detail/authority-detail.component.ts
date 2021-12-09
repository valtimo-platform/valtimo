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
import {Authority} from '@valtimo/contract';
import {AuthorityService} from '../authority.service';
import {ActivatedRoute, Router} from '@angular/router';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {AlertService} from '@valtimo/components';
import {Subscription} from 'rxjs';
import {first} from 'rxjs/operators';

@Component({
  selector: 'valtimo-authority-detail',
  templateUrl: './authority-detail.component.html',
  styleUrls: ['./authority-detail.component.css']
})
export class AuthorityDetailComponent implements OnInit, OnDestroy {

  public name: string;
  public authority: Authority;
  public form: FormGroup;
  private alertSub: Subscription = Subscription.EMPTY;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private service: AuthorityService,
    private alertService: AlertService
  ) {
    const snapshot = this.route.snapshot.paramMap;
    this.name = snapshot.get('name');
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

  private initData(name) {
    this.service.get(name).subscribe(result => {
      this.authority = result;
      this.setValues();
    });
  }

  private setValues() {
    if (this.authority) {
      // set authority values
      this.authority.hourlyRateDisplayString = this.authority.hourlyRate.displayString;
      this.authority.systemAuthorityDisplayString = this.authority.systemAuthority ? 'Yes' : 'No';

      // set form values
      this.form.controls.name.setValue(this.authority.name);
      this.form.controls.hourlyRate.setValue(this.authority.hourlyRate.amount);
    }
  }

  private createFormGroup() {
    return this.formBuilder.group({
      name: new FormControl('', Validators.required),
      hourlyRate: new FormControl('', Validators.required)
    });
  }

  public reset() {
    this.form = this.createFormGroup();
    this.initData(this.name);
  }

  public delete() {
    if (!this.alertSub.closed) {
      return;
    }
    // confirm action
    const mssg = 'Delete Entitlement?';
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
    this.service.delete(this.name).subscribe(() => {
      this.router.navigate([`/entitlements`]);
      this.alertService.success('Entitlement has been deleted');
    });
  }

  public onSubmit() {
    this.service.update(this.form.value).subscribe(() => {
      this.reset();
      this.alertService.success('Entitlement has been updated');
    });
  }

}
