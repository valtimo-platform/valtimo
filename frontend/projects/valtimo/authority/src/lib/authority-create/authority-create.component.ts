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
import {AuthorityService} from '../authority.service';
import {Router} from '@angular/router';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {AlertService} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-authority-create',
  templateUrl: './authority-create.component.html',
  styleUrls: ['./authority-create.component.css'],
})
export class AuthorityCreateComponent implements OnInit {
  public form: FormGroup;

  constructor(
    private readonly router: Router,
    private readonly formBuilder: FormBuilder,
    private readonly service: AuthorityService,
    private readonly alertService: AlertService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit() {
    this.reset();
  }

  public get formControls() {
    return this.form.controls;
  }

  private createFormGroup() {
    return this.formBuilder.group({
      name: new FormControl('', Validators.required),
    });
  }

  public onSubmit() {
    this.service.create(this.form.value).subscribe(result => {
      this.router.navigate([`/entitlements/entitlement/${encodeURI(result.name)}`]);
      this.alertService.success(this.translateService.instant('entitlement.entitlementCreated'));
    });
  }

  public reset() {
    this.form = this.createFormGroup();
  }
}
