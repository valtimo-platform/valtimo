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

package com.ritense.aws.config;

import org.hamcrest.MatcherAssert;
import org.junit.jupiter.api.Test;
import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import software.amazon.awssdk.auth.credentials.AwsCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProviderChain;
import software.amazon.awssdk.profiles.ProfileFile;
import java.io.File;
import java.util.Objects;

class ValtimoCredentialsProviderChainTest {

    private final ProfileFile profileFile;

    ValtimoCredentialsProviderChainTest() {
        ClassLoader classLoader = getClass().getClassLoader();
        File file = new File(Objects.requireNonNull(classLoader.getResource("aws/credentials")).getFile());

        profileFile = ProfileFile.builder()
            .content(file.toPath())
            .type(ProfileFile.Type.CREDENTIALS)
            .build();
    }

    @Test
    void shouldUseProvidedProfileCredentials() {
        try (AwsCredentialsProviderChain chain = ValtimoCredentialsProviderChain.create(profileFile, "fakeprofile")) {
            AwsCredentials awsCredentials = chain.resolveCredentials();
            MatcherAssert.assertThat(awsCredentials, is(notNullValue()));
            MatcherAssert.assertThat(awsCredentials.accessKeyId(), equalTo("HnxKGI0lZyskLlNSDSDb"));
        }
    }

    @Test
    void shouldUseDefaultProfileCredentials() {
        try (AwsCredentialsProviderChain chain = ValtimoCredentialsProviderChain.create(profileFile, null)) {
            AwsCredentials awsCredentials = chain.resolveCredentials();
            MatcherAssert.assertThat(awsCredentials, is(notNullValue()));
            MatcherAssert.assertThat(awsCredentials.accessKeyId(), equalTo("IHE9OG1UVCrtL2i9rN4j"));
        }
    }

}