/*
 * Copyright 2015-2022 Ritense BV, the Netherlands.
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

import org.springframework.lang.Nullable;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProviderChain;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.profiles.ProfileFile;

public class ValtimoCredentialsProviderChain {
    private ValtimoCredentialsProviderChain() {
    }

    public static AwsCredentialsProviderChain create(String awsProfile) {
        return create(null, awsProfile);
    }

    public static AwsCredentialsProviderChain create(@Nullable ProfileFile profileFile, @Nullable String awsProfile) {
        DefaultCredentialsProvider.Builder builder = DefaultCredentialsProvider.builder();

        if (awsProfile != null && !awsProfile.isBlank()) {
            builder.profileName(awsProfile);
        }

        if (profileFile != null) {
            builder.profileFile(profileFile);
        }

        return AwsCredentialsProviderChain.of(builder.build());
    }
}
