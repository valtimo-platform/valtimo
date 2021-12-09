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
  selector: 'valtimo-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit, OnDestroy {

  public profile: any;
  public form: FormGroup;
  public resourceIds: Array<any> = [];

  constructor(
    private formBuilder: FormBuilder,
    private alertService: AlertService
    // private userProviderService: UserProviderService
  ) { }

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
 /*   this.userProviderService.getUserIdentity().subscribe(value => {
      this.profile = value;
      this.setValues();
    });*/
  }

  private setValues() {
    if (this.profile) {
      // set humanize dates
      this.profile.humanize_dates = {
        created_at: moment(this.profile.created_at).fromNow(),
        updated_at: moment(this.profile.updated_at).fromNow(),
        last_password_reset: moment(this.profile.last_password_reset).fromNow()
      };
      // set form values
      this.form.controls.firstName.setValue(this.profile.user_metadata.firstname);
      this.form.controls.lastName.setValue(this.profile.user_metadata.lastname);
      this.form.controls.langKey.setValue(this.profile.user_metadata.langKey);
    }
  }

  private createFormGroup() {
    return this.formBuilder.group({
      firstName: new FormControl('', Validators.required),
      lastName: new FormControl('', Validators.required),
      langKey: new FormControl('', Validators.required)
    });
  }

  public onFileUpload(resources) {
    this.resourceIds = resources.map(resource => resource.id);
  }

  public onSubmit() {
    this.form.value.email = this.profile.email;
    // TODO Updating profile ?? allowed when using keycloak
   /* this.userService.updateProfile(this.form.value).subscribe(() => {
      this.alertService.success('Profile has been updated');
    });*/
  }

  public reset() {
    this.form = this.createFormGroup();
    this.initData();
  }

}
