import {AbstractControl, ValidationErrors, ValidatorFn} from '@angular/forms';
import {Injectable} from '@angular/core';
import {UrlResolverService} from './url-resolver.service';

@Injectable()
export class UrlValidatorService {

  constructor(
    private readonly urlResolverService: UrlResolverService) {
  }

  public urlValidator(variables: Map<string, string>): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const url = this.urlResolverService.resolveUrlVariables(control.value, variables);
      try {
        new URL(url);
        return null;
      } catch (_) {
        return {invalidUrl: url};
      }
    };
  }

}
