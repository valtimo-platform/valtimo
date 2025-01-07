import {Pipe, PipeTransform} from '@angular/core';

@Pipe({name: 'valtimoEllipsis', standalone: true})
export class EllipsisPipe implements PipeTransform {
  public transform(content: string, limit?: number | null): string {
    if (!limit) return content;

    return content.substring(0, limit) + (content.length > limit ? '...' : '');
  }
}
