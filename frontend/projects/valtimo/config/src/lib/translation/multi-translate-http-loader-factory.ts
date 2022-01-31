import {HttpClient} from '@angular/common/http';
import {MultiTranslateHttpLoader} from 'ngx-translate-multi-http-loader';
import {ConfigService} from '../config.service';

export function MultiTranslateHttpLoaderFactory(http: HttpClient, configService: ConfigService) {
  const translationResources = configService.config.translationResources;

  return new MultiTranslateHttpLoader(http, [
    {prefix: './valtimo-translation/core/', suffix: '.json'},
    ...(translationResources &&
    Array.isArray(translationResources) &&
    translationResources.length > 0
      ? translationResources
      : []),
  ]);
}
