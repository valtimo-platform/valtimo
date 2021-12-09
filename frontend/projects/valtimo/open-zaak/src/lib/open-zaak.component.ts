/*
 * Copyright 2020 Dimpact.
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

import {Component, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {OpenZaakService} from '@valtimo/resource';
import {AlertService, ModalComponent} from '@valtimo/components';
import {Router} from '@angular/router';
import {CreateOpenZaakConfigRequest, ModifyOpenZaakConfigRequest} from '@valtimo/contract';
import {NGXLogger} from 'ngx-logger';

@Component({
  selector: 'valtimo-open-zaak',
  templateUrl: './open-zaak.component.html',
  styleUrls: ['./open-zaak.component.scss']
})
export class OpenZaakComponent implements OnInit {

  public config: FormGroup;
  public id: string = null;

  @ViewChild('openZaakConfigModal') modal: ModalComponent;

  readonly OZ_SECRET_MIN_LENGTH: number = 32;

  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private openZaakService: OpenZaakService,
    private alertService: AlertService,
    private logger: NGXLogger
  ) {
  }

  ngOnInit() {
    this.createFormGroup();
    this.openZaakService.getOpenZaakConfig().subscribe(config => {
        if (config !== null) {
          this.logger.debug('Existing config', config);
          this.id = config.id;
          this.config.controls.url.setValue(config.url);
          this.config.controls.clientId.setValue(config.clientId);
          this.config.controls.secret.setValue(config.secret);
          this.config.controls.rsin.setValue(config.rsin);
        }
      }
    );
  }

  private createFormGroup() {
    this.config = this.formBuilder.group({
      url: new FormControl('', [
        Validators.required,
        Validators.maxLength(1024)
      ]),
      clientId: new FormControl('', [
        Validators.required,
        Validators.maxLength(255)
      ]),
      secret: new FormControl('', [
        Validators.required,
        Validators.minLength(this.OZ_SECRET_MIN_LENGTH)
      ]),
      rsin: new FormControl('', [
        Validators.required,
        Validators.minLength(9),
        Validators.maxLength(9)
      ])
    });
  }

  onSubmit() {
    if (this.id === null) {
      const request: CreateOpenZaakConfigRequest = {
        url: this.config.value.url,
        clientId: this.config.value.clientId,
        secret: this.config.value.secret,
        rsin: this.config.value.rsin
      };
      this.openZaakService.createOpenZaakConfig(request).subscribe(result => {
        this.logger.debug('result', result);
        this.id = result.openZaakConfig.id;
        this.alertService.success('Created new OpenZaak config');
      }, err => {
        this.alertService.error('Error creating new OpenZaak config');
      });
    } else {
      const request: ModifyOpenZaakConfigRequest = {
        url: this.config.value.url,
        clientId: this.config.value.clientId,
        secret: this.config.value.secret,
        rsin: this.config.value.rsin
      };
      this.openZaakService.modifyOpenZaakConfig(request).subscribe(result => {
        this.logger.debug('result', result);
        this.alertService.success('Modified OpenZaak config');
      }, err => {
        this.alertService.error('Error Modifying OpenZaak config');
      });
    }
  }

  reset() {
    this.createFormGroup();
  }

  openModal() {
    this.modal.show();
  }

  remove() {
    this.openZaakService.deleteOpenZaakConfig().subscribe(result => {
      this.logger.debug('result', result);
      this.alertService.success('Removed OpenZaak config');
      this.reset();
    }, err => {
      this.alertService.error('Error removing OpenZaak config');
    });
  }

  public get formControls() {
    return this.config.controls;
  }

}
