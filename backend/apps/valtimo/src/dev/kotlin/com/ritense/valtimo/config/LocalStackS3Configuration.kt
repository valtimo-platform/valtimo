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

package com.ritense.valtimo.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.AwsCredentialsProviderChain
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import software.amazon.awssdk.services.s3.model.CORSConfiguration
import software.amazon.awssdk.services.s3.model.CORSRule
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import java.net.URI

@Configuration
@Profile("dev")
class LocalStackS3Configuration {

    @Bean
    fun valtimoAwsCredentialsProviderChain(): AwsCredentialsProviderChain {
        return AwsCredentialsProviderChain.builder()
            .addCredentialsProvider(
                StaticCredentialsProvider.create(
                    AwsBasicCredentials.create("test", "test")
                )
            )
            .build()
    }

    @Bean
    fun s3Client(
        @Value("\${aws.s3.bucketRegion}") bucketRegion: String,
        @Value("\${aws.s3.endpoint:}") endpoint: String
    ): S3Client {
        val builder = S3Client.builder()
            .region(Region.of(bucketRegion))
            .credentialsProvider(
                StaticCredentialsProvider.create(
                    AwsBasicCredentials.create("test", "test")
                )
            )
            .forcePathStyle(true)

        if (endpoint.isNotBlank()) {
            builder.endpointOverride(URI.create(endpoint))
        }

        return builder.build()
    }

    @Bean
    fun s3Presigner(
        @Value("\${aws.s3.bucketRegion}") bucketRegion: String,
        @Value("\${aws.s3.endpoint:}") endpoint: String
    ): S3Presigner {
        val builder = S3Presigner.builder()
            .region(Region.of(bucketRegion))
            .credentialsProvider(
                StaticCredentialsProvider.create(
                    AwsBasicCredentials.create("test", "test")
                )
            )
            .serviceConfiguration(
                S3Configuration.builder()
                    .pathStyleAccessEnabled(true)
                    .build()
            )

        if (endpoint.isNotBlank()) {
            builder.endpointOverride(URI.create(endpoint))
        }

        return builder.build()
    }

    /**
     * Creates the upload bucket and its CORS policy in LocalStack on startup so
     * browser presigned-URL uploads work out of the box. Replaces the init-s3.sh
     * script that the old app mounted into the LocalStack container.
     */
    @Bean
    fun localStackS3BucketInitializer(
        s3Client: S3Client,
        @Value("\${aws.s3.bucketName}") bucketName: String
    ): CommandLineRunner {
        return CommandLineRunner {
            val bucketExists = s3Client.listBuckets().buckets().any { it.name() == bucketName }
            if (!bucketExists) {
                s3Client.createBucket { it.bucket(bucketName) }
            }
            s3Client.putBucketCors { request ->
                request.bucket(bucketName)
                    .corsConfiguration(
                        CORSConfiguration.builder()
                            .corsRules(
                                CORSRule.builder()
                                    .allowedHeaders("*")
                                    .allowedMethods("GET", "PUT", "POST", "DELETE", "HEAD")
                                    .allowedOrigins("*")
                                    .exposeHeaders("ETag")
                                    .build()
                            )
                            .build()
                    )
            }
        }
    }
}
