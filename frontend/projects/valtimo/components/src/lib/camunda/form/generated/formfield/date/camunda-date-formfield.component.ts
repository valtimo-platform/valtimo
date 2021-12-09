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

import {AfterViewInit, Component, OnInit} from '@angular/core';
import {FormGroup} from '@angular/forms';
import {FormField} from '../formfield.model';
import {CamundaFormfieldService} from '../camunda-formfield.service';
import * as momentImported from 'moment';

const moment = momentImported;
moment.locale(localStorage.getItem('langKey'));
declare var $;

@Component({
  selector: 'valtimo-camunda-date-formfield',
  templateUrl: './camunda-date-formfield.component.html'
})
export class CamundaDateFormfieldComponent implements OnInit, AfterViewInit {

  public formGroup: FormGroup;
  public formField: FormField;

  private INPUT_SELECTOR: string;
  private datePickerOptions: any = {};

  constructor(private formFieldService: CamundaFormfieldService) {
  }

  ngOnInit(): void {
    this.INPUT_SELECTOR = '#' + this.formField.id;
    this.datePickerOptions = {
      autoclose: true,
      componentIcon: '.mdi.mdi-calendar',
      navIcons: {
        rightIcon: 'mdi mdi-chevron-right',
        leftIcon: 'mdi mdi-chevron-left'
      },
      format: 'dd-mm-yyyy'
    };
  }

  ngAfterViewInit(): void {
    const formGroup = this.formGroup;
    const formField = this.formField;

    const maxDate = this.formFieldService.getMaxDate(this.formField);
    if (maxDate) {
      this.datePickerOptions.endDate = maxDate.configuration;
    }

    const minDate = this.formFieldService.getMinDate(this.formField);
    if (minDate) {
      this.datePickerOptions.startDate = minDate.configuration;
    }

    $(this.INPUT_SELECTOR).datetimepicker(this.datePickerOptions);
    $(this.INPUT_SELECTOR).on('changeDate', function(e) {
      formGroup.patchValue({
        [formField.id]: moment(e.date.valueOf()).format('DD/MM/YYYY')
      });
    });
  }

}
