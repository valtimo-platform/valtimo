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

import com.ritense.resource.repository.S3ResourceRepository
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.web.client.RestTemplate

abstract class BaseTest {

    @Mock
    lateinit var restTemplate: RestTemplate

    @Mock
    lateinit var s3ResourceRepository: S3ResourceRepository

    fun baseSetUp() {
        MockitoAnnotations.openMocks(this)
    }

    fun httpHeaders(): HttpHeaders {
        val header = HttpHeaders()
        header.contentType = MediaType.APPLICATION_JSON
        return header
    }

}