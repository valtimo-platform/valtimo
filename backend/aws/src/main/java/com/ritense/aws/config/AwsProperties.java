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

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "aws")
public class AwsProperties {

    private String profile;

    private String region;

    public String getProfile() {
        return profile;
    }

    public void setProfile(String profile) {
        this.profile = profile;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    private final SQS sqs = new SQS();

    private final SNS sns = new SNS();

    private final S3 s3 = new S3();

    private final SSM ssm = new SSM();

    public SQS getSqs() {
        return sqs;
    }

    public SNS getSns() {
        return sns;
    }

    public S3 getS3() {
        return s3;
    }

    public SSM getSsm() {
        return ssm;
    }

    public static class SQS {

        private boolean enabled;

        private String queue;

        private String concurency;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getQueue() {
            return queue;
        }

        public void setQueue(String queue) {
            this.queue = queue;
        }

        public String getConcurency() {
            return concurency;
        }

        public void setConcurency(String concurency) {
            this.concurency = concurency;
        }
    }

    public static class SNS {

        private String topic;

        public String getTopic() {
            return topic;
        }

        public void setTopic(String topic) {
            this.topic = topic;
        }
    }

    public static class S3 {

        private String bucketRegion;
        private String bucketName;

        public String getBucketRegion() {
            return bucketRegion;
        }

        public void setBucketRegion(String bucketRegion) {
            this.bucketRegion = bucketRegion;
        }

        public String getBucketName() {
            return bucketName;
        }

        public void setBucketName(String bucketName) {
            this.bucketName = bucketName;
        }
    }

    public static class SSM {

        private boolean enabled;

        private String region;

        private String projectName;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getRegion() {
            return region;
        }

        public void setRegion(String region) {
            this.region = region;
        }

        public String getProjectName() {
            return projectName;
        }

        public void setProjectName(String projectName) {
            this.projectName = projectName;
        }
    }
}

