/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.document.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;

@ConfigurationProperties(prefix = "valtimo.document")
public class DocumentProperties {

    private final Method method;

    @ConstructorBinding
    public DocumentProperties(Method method) {
        this.method = method != null ? method : new DocumentProperties.Method();
    }

    public Method getMethod() {
        return method;
    }

    public static class Method {
        private boolean pessimisticLockingInValueResolverEnabled;

        public boolean isPessimisticLockingInValueResolverEnabled() {
            return pessimisticLockingInValueResolverEnabled;
        }
    }
}