import {FormManagementService} from '../form-management.service';
import {AbstractControl, AsyncValidatorFn, ValidationErrors} from '@angular/forms';
import {map, Observable} from 'rxjs';

export function noDuplicateFormValidator(
  formManagementService: FormManagementService
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors> => formManagementService
      .existsFormDefinition(control.value.toString())
      .pipe(map((result: boolean) => (result ? {duplicate: true} : null)));
}
