import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {BUILDING_BLOCKS} from '../mocks';
import {BuildingBlock} from '../models';

@Injectable({
  providedIn: 'root',
})
export class BuildingBlockApiService {
  public readonly buildingBlocks$ = of(BUILDING_BLOCKS);

  public getBuildingBlock(id: string): Observable<BuildingBlock | null> {
    return of(BUILDING_BLOCKS.find((block: BuildingBlock) => block.id === id) ?? null);
  }
}
