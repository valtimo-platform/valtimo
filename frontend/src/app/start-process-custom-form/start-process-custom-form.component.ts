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

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProcessService } from '@valtimo/process';

@Component({
  selector: 'app-start-process-custom-form',
  templateUrl: './start-process-custom-form.component.html',
  styleUrls: ['./start-process-custom-form.component.scss']
})
export class StartProcessCustomFormComponent implements OnInit {
  public processDefinition: any;
  public startProcessCustomForm: FormGroup;
  public key: string;
  public businessKeyFieldId: string;
  public submitted = false;

  constructor(
    private processService: ProcessService,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private toastr: ToastrService,
    private router: Router,
  ) {
    this.key = this.route.snapshot.paramMap.get('key');
  }

  ngOnInit() {
    this.getProcessDefinition(this.key);
    this.startProcessCustomForm = this.createFormGroup();
  }

  get f() { return this.startProcessCustomForm.controls; }

  private getProcessDefinition(key) {
    this.processService.getProcessDefinition(key).subscribe(response => {
      this.processDefinition = response;
      this.businessKeyFieldId = 'businessKey';
    });
  }

  private createFormGroup() {
    const group = this.formBuilder.group({
      businessKey: new FormControl('', Validators.required),
      inputTextarea: new FormControl('', Validators.required)
    });
    return group;
  }

  public reset() {
    this.submitted = false;
    this.startProcessCustomForm = this.createFormGroup();
  }

  public onSubmit() {
    this.submitted = true;
    const data = this.startProcessCustomForm.value;
    const businessKey = data[this.businessKeyFieldId];

    const variables = Object.assign({}, data);
    if (variables[this.businessKeyFieldId]) {
       delete variables[this.businessKeyFieldId];
    }
    if ( this.key && businessKey ) {
      this.processService.startProcesInstance(this.key, businessKey, variables).subscribe(response => {
        this.toastr.success(this.processDefinition.name + ' has successfully been started');
        this.router.navigate(['/dossiers/' + this.key]);
      });
    }
  }
}
