/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {FormArray, FormControl, FormGroup} from '@angular/forms';
import {BuildingBlockSyncTiming} from './process-link.model';

interface BuildingBlockField {
  name: string;
  required: boolean;
}

type InputRowFormGroup = FormGroup<{
  source: FormControl<string>;
  target: FormControl<string>;
}>;

type OutputRowFormGroup = FormGroup<{
  source: FormControl<string>;
  target: FormControl<string>;
  syncTiming: FormControl<BuildingBlockSyncTiming>;
}>;

type InputsFormGroup = FormGroup<{
  inputs: FormArray<InputRowFormGroup>;
}>;

type OutputsFormGroup = FormGroup<{
  outputs: FormArray<OutputRowFormGroup>;
}>;

export {
  BuildingBlockField,
  InputsFormGroup,
  OutputsFormGroup,
  InputRowFormGroup,
  OutputRowFormGroup,
};
