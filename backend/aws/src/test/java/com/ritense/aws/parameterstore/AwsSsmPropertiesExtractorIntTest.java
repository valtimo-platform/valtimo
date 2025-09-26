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

package com.ritense.aws.parameterstore;

import com.ritense.aws.BaseIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.PropertySource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParametersByPathRequest;
import software.amazon.awssdk.services.ssm.model.GetParametersByPathResponse;
import software.amazon.awssdk.services.ssm.model.Parameter;

import javax.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

@TestPropertySource(
    properties = {
        "aws.ssm.projectName=" + AwsSsmPropertiesExtractorIntTest.projectName,
        "aws.ssm.region=eu-central-1"
    }
)
@ActiveProfiles(AwsSsmPropertiesExtractorIntTest.profile)
@Tag("integration")
public class AwsSsmPropertiesExtractorIntTest extends BaseIntegrationTest {

    public static final String projectName = "Valtimo-Implementation";
    public static final String profile = "dev";
    private static final Map<String, String> testProperties = Map.of(
        "test.test", "Test1234",
        "test.test2", "Test12342",
        "test.test3", "Test12343",
        "test.test4", "Test12344"
    );

    @Autowired
    private ConfigurableEnvironment configurableEnvironment;
    private ApplicationEnvironmentPreparedEvent preparedEvent;
    private ConfigurableEnvironment configurableEnvironmentSpy;
    private SsmClient ssmClient;

    @BeforeEach
    public void setUp() {
        preparedEvent = mock(ApplicationEnvironmentPreparedEvent.class);
        configurableEnvironmentSpy = spy(configurableEnvironment);
        ssmClient = mock(SsmClient.class);
    }

    @Test
    public void shouldExtractProperties() {
        MutablePropertySources propertySources = new MutablePropertySources();

        when(preparedEvent.getEnvironment()).thenReturn(configurableEnvironmentSpy);
        when(configurableEnvironmentSpy.getPropertySources()).thenReturn(propertySources);
        doReturn(true).when(configurableEnvironmentSpy).getProperty(eq("aws.ssm.enabled"), eq(Boolean.class), eq(false));
        when(ssmClient.getParametersByPath(any(GetParametersByPathRequest.class))).thenReturn(getGetParametersByPathResponse());

        var parameterStoreConfiguration = new ParameterStoreConfiguration(preparedEvent);

        //when
        var awsSsmPropertiesExtractor = new AwsSsmPropertiesExtractor(parameterStoreConfiguration, ssmClient);

        //then
        assertThat(propertySources).hasSize(1);

        PropertySource<?> propertySource = propertySources.iterator().next();
        for (Map.Entry<String, String> testProperty : testProperties.entrySet()) {
            assertThat(propertySource.containsProperty(testProperty.getKey())).isTrue();
            assertThat(testProperty.getValue()).isEqualTo(propertySource.getProperty(testProperty.getKey()));
        }
    }

    @Test
    public void shouldNotExtractProperties() {
        MutablePropertySources propertySources = new MutablePropertySources();

        when(preparedEvent.getEnvironment()).thenReturn(configurableEnvironmentSpy);
        when(configurableEnvironmentSpy.getPropertySources()).thenReturn(propertySources);
        doReturn(false).when(configurableEnvironmentSpy).getProperty(eq("aws.ssm.enabled"), eq(Boolean.class), eq(false));

        var parameterStoreConfiguration = new ParameterStoreConfiguration(preparedEvent);

        //when
        var awsSsmPropertiesExtractor = new AwsSsmPropertiesExtractor(parameterStoreConfiguration, ssmClient);

        //then
        assertThat(propertySources).hasSize(0);
    }

    @NotNull
    private GetParametersByPathResponse getGetParametersByPathResponse() {
        List<Parameter> parameters = new ArrayList<>(testProperties.size());
        for (Map.Entry<String, String> property : testProperties.entrySet()) {
            var p = Parameter.builder()
                .name(String.format("/%s/%s/%s", profile, projectName, property.getKey()))
                .value(property.getValue())
                .build();
            parameters.add(p);
        }
        return GetParametersByPathResponse.builder()
            .parameters(parameters)
            .build();
    }

}