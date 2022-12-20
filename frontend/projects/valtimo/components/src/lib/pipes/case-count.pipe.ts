import {Pipe, PipeTransform} from '@angular/core';

@Pipe({name: 'caseCount'})
export class CaseCountPipe implements PipeTransform {
  transform(caseCount: any): string {
    if (typeof caseCount === 'number') {
      if (caseCount > 99) {
        return '99+';
      } else {
        return `${caseCount}`;
      }
    }

    return '';
  }
}
