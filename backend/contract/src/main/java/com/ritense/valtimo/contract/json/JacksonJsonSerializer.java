/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.contract.json;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.hypersistence.utils.hibernate.type.util.JsonConfiguration;
import io.hypersistence.utils.hibernate.type.util.JsonSerializer;
import org.hibernate.internal.util.SerializationHelper;

import java.io.Serializable;

/**
 * Custom Hypersistence JsonSerializer that clones JSON objects.
 * Uses Java serialization when possible (preserves generic types in collections),
 * falls back to Jackson for non-serializable objects.
 */
public class JacksonJsonSerializer implements JsonSerializer {

    @Override
    public <T> T clone(T object) {
        if (object instanceof String) {
            return object;
        }
        if (object instanceof JsonNode jsonNode) {
            return (T) jsonNode.deepCopy();
        }
        if (object instanceof Serializable) {
            try {
                return (T) SerializationHelper.clone((Serializable) object);
            } catch (Exception e) {
                // Fall back to Jackson cloning for Serializable objects that fail
            }
        }
        ObjectMapper objectMapper = JsonConfiguration.INSTANCE.getObjectMapperWrapper().getObjectMapper();
        JsonNode tree = objectMapper.valueToTree(object);
        return (T) objectMapper.convertValue(tree, object.getClass());
    }
}
