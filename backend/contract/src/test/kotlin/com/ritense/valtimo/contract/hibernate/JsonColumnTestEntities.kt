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


package com.ritense.valtimo.contract.hibernate

import com.fasterxml.jackson.databind.node.ObjectNode
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.util.UUID

data class JsonPojo(
    var name: String? = null,
    var count: Int = 0,
    var tags: List<String> = emptyList(),
)

@Entity
@Table(name = "json_column_test")
class JsonColumnTestEntity(
    @Id
    @Column(name = "id")
    val id: UUID = UUID.randomUUID(),

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "object_node", columnDefinition = "json")
    var objectNode: ObjectNode? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "json_map", columnDefinition = "json")
    var jsonMap: MutableMap<String, Any?>? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "pojo_list", columnDefinition = "json")
    var pojoList: MutableList<JsonPojo>? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "pojo", columnDefinition = "json")
    var pojo: JsonPojo? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_json", columnDefinition = "json")
    var rawJson: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "flag", columnDefinition = "json")
    var flag: Boolean? = null,
)

@Entity
@Table(name = "json_plain_column_test")
class JsonPlainColumnTestEntity(
    @Id
    @Column(name = "id")
    val id: UUID = UUID.randomUUID(),

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "object_node", columnDefinition = "json")
    var objectNode: ObjectNode? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_json", columnDefinition = "json")
    var rawJson: String? = null,

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "long_text", columnDefinition = "text")
    var longText: String? = null,
)
