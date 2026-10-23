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

package com.ritense.authorization.permission.condition

import java.lang.reflect.Field

abstract class ReflectingPermissionCondition(type: PermissionConditionType) : PermissionCondition(type) {
    protected fun findEntityFieldValue(entity: Any, field: String): Any? {
        var currentEntity: Any? = entity
        var currentClass: Class<*> = entity.javaClass
        val fields = field.split('.')
        for (value in fields) {
            // Null in path resolves to null, but remaining segments are still validated against declared types
            val classToSearch = currentEntity?.javaClass ?: currentClass
            val declaredField = findDeclaredField(classToSearch, value)
                ?: throw NoSuchFieldException("Field $fields not found in class ${entity.javaClass}")
            currentClass = declaredField.type

            if (currentEntity != null) {
                declaredField.trySetAccessible()
                // Field.get(obj) does not (always) seem to work according to spec, because it throws a NullPointerException when the value of a property is null
                currentEntity = try {
                    declaredField.get(currentEntity)
                } catch (_: NullPointerException) {
                    null
                }
            }
        }
        return currentEntity
    }


    private fun findDeclaredField(clazz: Class<*>, fieldName: String): Field? {
        var classToSearch: Class<*>? = clazz
        while (classToSearch != null) {
            val match = classToSearch.declaredFields.firstOrNull { declared ->
                declared.name == fieldName ||
                    declared.getAnnotation(AuthorizationFieldAlias::class.java)?.names?.contains(fieldName) == true
            }
            if (match != null) {
                return match
            }
            classToSearch = classToSearch.superclass
        }
        return null
    }
}