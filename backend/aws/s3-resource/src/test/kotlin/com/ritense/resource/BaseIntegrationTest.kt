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

package com.ritense.resource

import com.ritense.resource.service.S3Service
import com.ritense.valtimo.contract.authentication.UserManagementService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.context.junit.jupiter.SpringExtension
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.presigner.S3Presigner

@SpringBootTest
@ExtendWith(SpringExtension::class)
@Tag("integration")
abstract class BaseIntegrationTest {

    @MockitoBean
    lateinit var userManagementService: UserManagementService

    @MockitoBean
    lateinit var s3Client: S3Client

    @MockitoBean
    lateinit var s3Presigner: S3Presigner

    @Autowired
    lateinit var s3Service: S3Service

    @BeforeEach
    fun beforeEach() {
    }

    @AfterEach
    fun afterEach() {
    }

    companion object {

        @BeforeAll
        @JvmStatic
        internal fun beforeAll() {
            //
        }

    }

}
