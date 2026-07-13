/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.aws.parameterstore;

import jakarta.annotation.Nonnull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.context.ApplicationListener;

public class AwsSsmPropertiesListener implements ApplicationListener<ApplicationEnvironmentPreparedEvent> {

    private static final Logger logger = LoggerFactory.getLogger(AwsSsmPropertiesListener.class);

    @Override
    public void onApplicationEvent(@Nonnull ApplicationEnvironmentPreparedEvent event) {
        logger.trace("Started AwsSsmPropertiesListener");
        final AwsSsmPropertiesExtractor awsSsmPropertiesExtractor = new AwsSsmPropertiesExtractor(
            new ParameterStoreConfiguration(event)
        );
    }

}
