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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {Authority} from '../models';
import {AuthorityService} from '../authority.service';
import {ActivatedRoute, Router} from '@angular/router';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {AlertService} from '@valtimo/components';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {first, map, take} from 'rxjs/operators';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-authority-detail',
  templateUrl: './authority-detail.component.html',
  styleUrls: ['./authority-detail.component.css'],
})
export class AuthorityDetailComponent implements OnInit, OnDestroy {
  public name: string;

  private authority$ = new BehaviorSubject<Authority>(undefined);
  public translatedAuthority$: Observable<Authority | undefined> = combineLatest([
    this.authority$,
    this.translateService.stream('entitlement.hasSystemAuthority'),
    this.translateService.stream('entitlement.noSystemAuthority'),
  ]).pipe(
    map(([authority, hasAuthorityString, noAuthorityString]) =>
      authority
        ? {
            ...authority,
            systemAuthorityDisplayString: authority?.systemAuthority
              ? hasAuthorityString
              : noAuthorityString,
          }
        : undefined
    )
  );

  readonly loading$ = new BehaviorSubject<boolean>(true);

  public form: FormGroup;
  private alertSub: Subscription = Subscription.EMPTY;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly formBuilder: FormBuilder,
    private readonly service: AuthorityService,
    private readonly alertService: AlertService,
    private readonly translateService: TranslateService
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
      this.authority$.next(result);
      this.loading$.next(false);
      this.setValues();
    });
  }

  private setValues() {
    this.authority$.pipe(take(1)).subscribe(authority => {
      if (authority) {
        this.form.controls.name.setValue(authority.name);
      }
    });
  }

  private createFormGroup() {
    return this.formBuilder.group({
      name: new FormControl('', Validators.required),
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
    const mssg = this.translateService.instant('entitlement.deleteEntitlement');
    const confirmations = [
      {
        label: this.translateService.instant('entitlement.cancel'),
        class: 'btn btn-default',
        value: false,
      },
      {
        label: this.translateService.instant('entitlement.delete'),
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
          this.deleteConfirmed();
        }
      });
  }

  private deleteConfirmed() {
    this.service.delete(this.name).subscribe(() => {
      this.router.navigate([`/entitlements`]);
      this.alertService.success(this.translateService.instant('entitlement.entitlementDeleted'));
    });
  }

  public onSubmit() {
    this.service.update(this.form.value).subscribe(() => {
      this.reset();
      this.alertService.success(this.translateService.instant('entitlement.entitlementUpdated'));
    });
  }
}
