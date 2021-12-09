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
import {AlertService} from '@valtimo/components';
import * as momentImported from 'moment';

const moment = momentImported;
moment.locale(localStorage.getItem('langKey'));

@Component({
  selector: 'valtimo-password',
  templateUrl: './password.component.html',
  styleUrls: ['./password.component.css']
})
export class PasswordComponent implements OnInit, OnDestroy {

  public profile: any;
  public errorMsg: string;
  public form: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    private alertService: AlertService
  ) {
  }

  ngOnInit() {
    this.reset();
  }

  ngOnDestroy() {
    location.reload();
  }

  get formControls() {
    return this.form.controls;
  }

  private initData() {
   /* this.userService.getUserIdentity().subscribe(value => {
      this.profile = value;
      this.setValues();
    });*/
  }

  private setValues() {
    if (this.profile) {
      // humanize dates
      this.profile.humanize_dates = {
        created_at: moment(this.profile.created_at).fromNow(),
        updated_at: moment(this.profile.updated_at).fromNow(),
        last_password_reset: moment(this.profile.last_password_reset).fromNow()
      };
    }
  }

  private createFormGroup() {
    return this.formBuilder.group({
      password: new FormControl('', [Validators.required
        , Validators.pattern('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[$@$!%*?&]).{4,}')
        , Validators.maxLength(50)]),
      confirmPassword: new FormControl('', [Validators.required
        , Validators.minLength(4)
        , Validators.maxLength(50)])
    }, {
      validator: this.mustMatch('password', 'confirmPassword')
    });
  }

  public mustMatch(controlName: string, matchingControlName: string) {
    return (formGroup: FormGroup) => {
      const control = formGroup.controls[controlName];
      const matchingControl = formGroup.controls[matchingControlName];
      if (matchingControl.errors && !matchingControl.errors.mustMatch) {
        return;
      }
      if (control.value !== matchingControl.value) {
        matchingControl.setErrors({mustMatch: true});
      } else {
        matchingControl.setErrors(null);
      }
    };
  }

  public onSubmit() {
   /* this.userService.changePassword(this.form.value.password).subscribe(() => {
      this.alertService.success('Password has been changed');
    }, result => {
      this.errorMsg = result.error.detail.split(': ', 2)[1];
      this.reset();
    });*/
  }

  public reset() {
    this.form = this.createFormGroup();
    this.initData();
  }

}
