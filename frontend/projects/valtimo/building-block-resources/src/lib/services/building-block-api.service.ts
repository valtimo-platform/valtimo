import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, map, of, tap} from 'rxjs';
import {BUILDING_BLOCKS} from '../mocks';
import {BuildingBlock} from '../models';

@Injectable({
  providedIn: 'root',
})
export class BuildingBlockApiService {
  private readonly _buildingBlocks$ = new BehaviorSubject<BuildingBlock[]>(BUILDING_BLOCKS);
  public get buildingBlocks$(): Observable<BuildingBlock[]> {
    return this._buildingBlocks$.asObservable();
  }

  public getBuildingBlock(id: string): Observable<BuildingBlock | null> {
    return this.buildingBlocks$.pipe(
      map(
        (blocks: BuildingBlock[]) => blocks.find((block: BuildingBlock) => block.id === id) ?? null
      )
    );
  }

  public linkBlockToCase(documentDefinitionName: string, blockId: string): void {
    if (!documentDefinitionName || !blockId) return;

    this._buildingBlocks$.next(
      this._buildingBlocks$
        .getValue()
        .map((block: BuildingBlock) =>
          block.id === blockId
            ? {...block, linkedCaseIds: [...block.linkedCaseIds, documentDefinitionName]}
            : block
        )
    );
  }

  public unlinkBlockFromCase(documentDefinitionName: string, blockId: string): void {
    if (!documentDefinitionName || !blockId) return;

    this._buildingBlocks$.next(
      this._buildingBlocks$.getValue().map((block: BuildingBlock) =>
        block.id === blockId
          ? {
              ...block,
              linkedCaseIds: block.linkedCaseIds.filter(
                (caseId: string) => caseId !== documentDefinitionName
              ),
            }
          : block
      )
    );
  }
}
