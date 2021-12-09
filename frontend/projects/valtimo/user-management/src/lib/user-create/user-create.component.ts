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

import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {UserManagementService} from '../user-management.service';
import {AlertService} from '@valtimo/components';
import {ROLE_USER} from '@valtimo/contract';

@Component({
  selector: 'valtimo-user-create',
  templateUrl: './user-create.component.html',
  styleUrls: ['./user-create.component.css']
})
export class UserCreateComponent implements OnInit {

  public form: FormGroup;
  public authorities: Array<any>;

  constructor(
    private router: Router,
    private service: UserManagementService,
    private formBuilder: FormBuilder,
    private alertService: AlertService
  ) {
  }

  ngOnInit() {
    this.getAuthorities();
    this.reset();
  }

  private createFormGroup() {
    return this.formBuilder.group({
      email: new FormControl('', Validators.required),
      password: new FormControl('', [Validators.required
        , Validators.pattern('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[$@$!%*?&]).{4,}')
        , Validators.maxLength(50)]),
      firstName: new FormControl('', Validators.required),
      lastName: new FormControl('', Validators.required),
      langKey: new FormControl('', Validators.required),
      roles: new FormControl('', Validators.required)
    });
  }

  private setValues() {
    this.form.controls.roles.setValue([ROLE_USER]);
  }

  public validateRole(role) {
    return this.form.controls.roles.value.indexOf(role) !== -1;
  }

  public toggleRole(role) {
    const rolesArray = this.form.controls.roles.value;
    const posRoleInRoles = rolesArray.indexOf(role);
    if (posRoleInRoles === -1) {
      rolesArray.push(role);
    } else {
      rolesArray.splice(posRoleInRoles, 1);
    }
    this.form.controls.roles.setValue(rolesArray);
  }

  private getAuthorities() {
    this.service.getAuthorities({page: 0, size: 100}).subscribe(results => {
      this.authorities = results.body;
    });
  }

  public get formControls() {
    return this.form.controls;
  }

  public onSubmit() {
    this.service.create(this.form.value).subscribe(result => {
      this.router.navigate([`/users/user/${encodeURI(result.id)}`]);
      this.alertService.success('New Account has been created');
    });
  }

  public reset() {
    this.form = this.createFormGroup();
    this.setValues();
  }

  public getRoleUser(): string {
    return ROLE_USER;
  }

}
