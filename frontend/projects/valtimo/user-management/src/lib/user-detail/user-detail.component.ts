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
import {ROLE_DEVELOPER, ROLE_USER, User} from '@valtimo/contract';
import {UserManagementService} from '../user-management.service';
import {ActivatedRoute, Router} from '@angular/router';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {AlertService} from '@valtimo/components';

@Component({
  selector: 'valtimo-user-detail',
  templateUrl: './user-detail.component.html',
  styleUrls: ['./user-detail.component.css']
})
export class UserDetailComponent implements OnInit {

  public id: string;
  public user: User;
  public form: FormGroup;
  public authorities: Array<any>;
  private isDeveloper: boolean;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private service: UserManagementService,
    private formBuilder: FormBuilder,
    private alertService: AlertService
  ) {
    const snapshot = this.route.snapshot.paramMap;
    this.id = snapshot.get('id');
  }

  ngOnInit() {
    this.getAuthorities();
    this.reset();
  }

  public get formControls() {
    return this.form.controls;
  }

  private initData(id) {
    this.service.get(id).subscribe(result => {
      this.user = result;
      this.isDeveloper = this.user.roles.includes(ROLE_DEVELOPER);
      this.setValues();
    });
  }

  private setValues() {
    if (this.user) {
      // set user values
      this.user.verified = this.user.emailVerified ? 'Yes' : 'No';
      this.user.status = this.user.activated ? 'Activated' : 'Blocked';
      // set form values
      this.form.controls.id.setValue(this.user.id);
      this.form.controls.firstName.setValue(this.user.firstName);
      this.form.controls.lastName.setValue(this.user.lastName);
      this.form.controls.langKey.setValue(this.user.langKey);
      this.form.controls.roles.setValue(this.user.roles);
      this.form.controls.activated.setValue(this.user.activated);
      this.form.controls.emailVerified.setValue(this.user.emailVerified);
    }
  }

  private createFormGroup() {
    return this.formBuilder.group({
      id: new FormControl('', Validators.required),
      firstName: new FormControl('', Validators.required),
      lastName: new FormControl('', Validators.required),
      langKey: new FormControl('', Validators.required),
      roles: new FormControl('', Validators.required),
      activated: new FormControl(''),
      emailVerified: new FormControl('')
    });
  }

  public validateRole(role) {
    return this.form.controls.roles.value.indexOf(role) !== -1;
  }

  public getRoleUser(): string {
    return ROLE_USER;
  }

  public toggleRole(role): boolean {
    if (role === ROLE_USER || (!this.isDeveloper && role === ROLE_DEVELOPER)) {
      return false;
    }
    const rolesArray = this.form.controls.roles.value;
    const posRoleInRoles = rolesArray.indexOf(role);
    if (posRoleInRoles === -1) {
      rolesArray.push(role);
    } else {
      rolesArray.splice(posRoleInRoles, 1);
    }
    this.form.controls.roles.setValue(rolesArray);
    return true;
  }

  private getAuthorities() {
    this.service.getAuthorities({page: 0, size: 100}).subscribe(results => {
      this.authorities = results.body;
    });
  }

  public activate() {
    // confirm action
    const mssg = 'Activate account?';
    const confirmations = [
      {
        label: 'Cancel',
        class: 'btn btn-default',
        value: false
      },
      {
        label: 'Activate',
        class: 'btn btn-primary',
        value: true
      }
    ];
    this.alertService.notification(mssg, confirmations);
    this.alertService.getAlertConfirmChangeEmitter()
      .subscribe(alert => {
        if (alert.confirm === true) {
          this.activateConfirmed();
        }
      });
  }

  private activateConfirmed() {
    this.service.activate(this.id).subscribe(() => {
      this.reset();
      this.alertService.success('Account has been activated');
    });
  }

  public deactivate() {
    // confirm action
    const mssg = 'Deactivate account?';
    const confirmations = [
      {
        label: 'Cancel',
        class: 'btn btn-default',
        value: false
      },
      {
        label: 'Deactivate',
        class: 'btn btn-primary',
        value: true
      }
    ];
    this.alertService.notification(mssg, confirmations);
    this.alertService.getAlertConfirmChangeEmitter()
      .subscribe(alert => {
        if (alert.confirm === true) {
          this.deactivateConfirmed();
        }
      });
  }

  private deactivateConfirmed() {
    this.service.deactivate(this.id).subscribe(() => {
      this.reset();
      this.alertService.success('Account has been deactivated');
    });
  }

  public resendVerificationEmail() {
    // confirm action
    const mssg = 'Resend verification email?';
    const confirmations = [
      {
        label: 'Cancel',
        class: 'btn btn-default',
        value: false
      },
      {
        label: 'Resend verification email',
        class: 'btn btn-primary',
        value: true
      }
    ];
    this.alertService.notification(mssg, confirmations);
    this.alertService.getAlertConfirmChangeEmitter()
      .subscribe(alert => {
        if (alert.confirm === true) {
          this.resendVerificationEmailConfirmed();
        }
      });
  }

  private resendVerificationEmailConfirmed() {
    this.service.resendVerificationEmail(this.id).subscribe(() => {
      this.reset();
      this.alertService.success('Another verification email has been sent');
    });
  }

  public delete() {
    // confirm action
    const mssg = 'Delete account?';
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
    this.alertService.getAlertConfirmChangeEmitter()
      .subscribe(alert => {
        if (alert.confirm === true) {
          this.deleteConfirmed();
        }
      });
  }

  private deleteConfirmed() {
    this.service.delete(this.id).subscribe(() => {
      this.router.navigate([`/users`]);
      this.alertService.success('Account has been deleted');
    });
  }

  public onSubmit() {
    this.service.update(this.form.value).subscribe(() => {
      this.reset();
      this.alertService.success('User details have been updated');
    });
  }

  public reset() {
    this.form = this.createFormGroup();
    this.initData(this.id);
  }

}
