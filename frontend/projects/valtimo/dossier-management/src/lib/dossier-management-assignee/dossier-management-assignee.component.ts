import {Component} from '@angular/core';
import {DocumentService, CaseSettings} from '@valtimo/document';
import {BehaviorSubject, map, Observable, switchMap} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {tap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-dossier-management-assignee',
  templateUrl: './dossier-management-assignee.component.html',
  styleUrls: ['./dossier-management-assignee.component.css'],
})
export class DossierManagementAssigneeComponent {
  readonly disabled$ = new BehaviorSubject<boolean>(false);

  private readonly _refresh$ = new BehaviorSubject<null>(null);

  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || '')
  );

  readonly currentValue$: Observable<CaseSettings> = this._refresh$.pipe(
    switchMap(() => this.documentDefinitionName$),
    switchMap(documentDefinitionName =>
      this.documentService.getCaseSettings(documentDefinitionName)
    ),
    tap(() => this.loading$.next(false))
  );

  constructor(private readonly documentService: DocumentService, private route: ActivatedRoute) {
    this.disabled$ = new BehaviorSubject<boolean>(false);
  }

  toggleAssignee(currentValue: boolean, documentDefinitionName: string): void {
    this.disableInput();

    this.documentService
      .patchCaseSettings(documentDefinitionName, {
        canHaveAssignee: currentValue,
      })
      .subscribe(
        () => {
          this.enableInput();
          this.refreshAssignee();
        },
        () => {
          this.enableInput();
        }
      );
  }

  disableInput(): void {
    this.disabled$.next(true);
  }

  enableInput(): void {
    this.disabled$.next(false);
  }

  private refreshAssignee(): void {
    this._refresh$.next(null);
  }
}
