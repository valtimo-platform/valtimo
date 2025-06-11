import {Injectable} from '@angular/core';
import {CaseDefinition, DocumentService} from '@valtimo/document';
import {MenuItem} from '@valtimo/shared';
import {Observable, Subject} from 'rxjs';
import {SseService} from '@valtimo/sse';

@Injectable({providedIn: 'root'})
export class CaseMenuService {
  constructor(private readonly documentService: DocumentService) {}

  public appendCaseSubMenuItems(
    menuItems: MenuItem[],
    disableCaseCount: boolean,
    sseService: SseService
  ): Observable<MenuItem[]> {
    return new Observable(subscriber => {
      this.documentService.getCaseDefinitions({active: true}).subscribe(definitions => {
        const countMap = disableCaseCount ? undefined : this.getCountMap(definitions, sseService);

        const caseItems: MenuItem[] = definitions.map((def, index) => ({
          link: ['/cases/' + def.caseDefinitionKey],
          title: def.name,
          iconClass: 'icon mdi mdi-dot-circle',
          sequence: index,
          show: true,
          ...(countMap && {
            count$: countMap.get(def.caseDefinitionKey),
          }),
        }));

        const index = menuItems.findIndex(i => i.title === 'Cases' || i.title === 'Dossiers');
        if (index >= 0) {
          menuItems[index].children = caseItems;
        }

        subscriber.next(menuItems);
      });
    });
  }

  private getCountMap(
    defs: CaseDefinition[],
    sseService: SseService
  ): Map<string, Subject<number>> {
    const map = new Map<string, Subject<number>>();
    defs.forEach(def => map.set(def.caseDefinitionKey, new Subject<number>()));

    sseService
      .getSseMessagesObservableByEventType(['CASE_UNASSIGNED', 'CASE_ASSIGNED', 'CASE_CREATED'])
      .subscribe(() => this.updateCounts(map));

    this.updateCounts(map);
    return map;
  }

  private updateCounts(map: Map<string, Subject<number>>): void {
    this.documentService.getOpenDocumentCount().subscribe(list => {
      list.forEach(entry => {
        const subject = map.get(entry.documentDefinitionName);
        if (subject) subject.next(entry.openDocumentCount);
      });
    });
  }
}
