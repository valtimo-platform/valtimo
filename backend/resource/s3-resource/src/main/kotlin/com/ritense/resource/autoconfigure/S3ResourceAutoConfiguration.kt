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

package com.ritense.resource.autoconfigure

import com.ritense.resource.domain.listener.ResourceRemovedEventListener
import com.ritense.resource.repository.S3ResourceRepository
import com.ritense.resource.service.ResourceService
import com.ritense.resource.service.S3Service
import com.ritense.resource.web.rest.S3Resource
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import software.amazon.awssdk.auth.credentials.AwsCredentialsProviderChain
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.presigner.S3Presigner

@Configuration
@EnableJpaRepositories(basePackages = ["com.ritense.resource.repository"])
@EntityScan("com.ritense.resource.domain")
class S3ResourceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(name = ["s3Presigner"])
    fun s3Presigner(
        @Value("\${aws.s3.bucketRegion}") bucketRegion: String,
        awsCredentialsProviderChain: AwsCredentialsProviderChain
    ): S3Presigner {
        return S3Presigner.builder()
            .credentialsProvider(awsCredentialsProviderChain)
            .region(Region.of(bucketRegion))
            .build()
    }

    @Bean
    @ConditionalOnMissingBean(name = ["s3Client"])
    fun s3Client(
        @Value("\${aws.s3.bucketRegion}") bucketRegion: String,
        awsCredentialsProviderChain: AwsCredentialsProviderChain
    ): S3Client {
        return S3Client.builder()
            .credentialsProvider(awsCredentialsProviderChain)
            .region(Region.of(bucketRegion))
            .build()
    }

    @Bean
    @ConditionalOnMissingBean(ResourceService::class)
    fun resourceService(
        @Value("\${aws.s3.bucketName}") bucketName: String,
        s3Client: S3Client,
        s3Presigner: S3Presigner,
        s3ResourceRepository: S3ResourceRepository
    ): S3Service {
        return S3Service(
            bucketName,
            s3Client,
            s3Presigner,
            s3ResourceRepository
        )
    }

    @Bean
    @ConditionalOnMissingBean(S3Resource::class)
    @ConditionalOnProperty(prefix = "aws.s3", name = ["bucketRegion"])
    fun resourceResource(s3Service: S3Service): S3Resource {
        return S3Resource(s3Service)
    }

    @Bean
    @ConditionalOnMissingBean(ResourceRemovedEventListener::class)
    fun resourceRemovedEventListener(resourceService: S3Service): ResourceRemovedEventListener {
        return ResourceRemovedEventListener(resourceService)
    }

}