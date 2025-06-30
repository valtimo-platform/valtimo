import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {IkoDataAggregate, IkoDataRequestUser} from '../models';

@Injectable({
  providedIn: 'root',
})
export class IkoApiService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getIkoDataAggregates(
    key?: string,
    title?: string,
    page: number = 0,
    size: number = 10000,
    sort: string = 'title,asc'
  ): Observable<{content: IkoDataAggregate[]}> {
    const params = new URLSearchParams();
    if (key) params.append('key', key);
    if (title) params.append('title', title);
    params.append('page', page.toString());
    params.append('size', size.toString());
    params.append('sort', sort);

    return this.httpClient.get<{content: IkoDataAggregate[]}>(
      this.getApiUrl(`/v1/iko-data-aggregate?${params.toString()}`)
    );
  }

  public getIkoDataRequests(ikoDataAggregateKey: string): Observable<IkoDataRequestUser[]> {
    return this.httpClient.get<IkoDataRequestUser[]>(
      this.getApiUrl(`/v1/iko-data-aggregate/${ikoDataAggregateKey}/data-request`)
    );
  }
}
