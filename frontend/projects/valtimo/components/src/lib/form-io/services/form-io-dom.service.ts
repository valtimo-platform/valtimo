import {Injectable} from '@angular/core';
import {FormIoStateService} from './form-io-state.service';
import {take} from 'rxjs/operators';

@Injectable()
export class FormIoDomService {

  constructor(
    private readonly stateService: FormIoStateService
  ) {
  }

  toggleSubmitButton(disabled: boolean): void {
    this.stateService.currentForm$.pipe(take(1)).subscribe((form) => {
      const button = (form.formioElement.nativeElement
        .getElementsByClassName('formio-component-submit')[0]
        .getElementsByClassName('btn-primary')[0] as HTMLInputElement);

      button.disabled = disabled;
    });
  }
}
