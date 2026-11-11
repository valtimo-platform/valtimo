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


package com.ritense.resource.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.security.MessageDigest
import java.time.LocalDateTime

@Entity
@Table(name = "s3_upload_ticket")
data class S3UploadTicket(

    @Id
    @Column(name = "key_hash", nullable = false, columnDefinition = "VARCHAR(64)")
    val keyHash: String,

    @Column(name = "s3_key", nullable = false, columnDefinition = "VARCHAR(1024)")
    val key: String,

    @Column(name = "created_by", nullable = false, columnDefinition = "VARCHAR(255)")
    val createdBy: String,

    @Column(name = "created_on", nullable = false, columnDefinition = "DATETIME")
    val createdOn: LocalDateTime = LocalDateTime.now()
) {

    companion object {

        fun of(key: String, createdBy: String): S3UploadTicket {
            return S3UploadTicket(hash(key), key, createdBy)
        }

        fun hash(key: String): String {
            return MessageDigest.getInstance("SHA-256")
                .digest(key.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
        }
    }
}
