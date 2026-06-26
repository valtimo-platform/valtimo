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

package com.ritense.valtimo.autoconfigure;

import com.ritense.valtimo.contract.hardening.service.HardeningService;
import com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer;
import com.ritense.valtimo.contract.security.config.oauth2.NoOAuth2ClientsConfiguredCondition;
import com.ritense.valtimo.contract.web.rest.error.ExceptionTranslator;
import com.ritense.valtimo.security.ActuatorRoleHealthEndpointGroups;
import com.ritense.valtimo.security.ActuatorSecurityFilterChainFactory;
import com.ritense.valtimo.security.CoreSecurityFactory;
import com.ritense.valtimo.security.Http401UnauthorizedEntryPoint;
import com.ritense.valtimo.security.SpringSecurityAuditorAware;
import com.ritense.valtimo.security.ValtimoCoreSecurityFactory;
import com.ritense.valtimo.security.config.AccountHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.ApiLoginHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.ChoiceFieldHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.CsrfHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.DenyAllHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.EmailNotificationSettingsSecurityConfigurer;
import com.ritense.valtimo.security.config.ErrorHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.JwtHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.OpenApiHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.OperatonCockpitHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.OperatonRestHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.PingHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.ProcessHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.ProcessInstanceHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.ReportingHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.SecurityHeaderProperties;
import com.ritense.valtimo.security.config.SecurityHeadersHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.StatelessHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.StaticResourcesHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.TaskHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.UserHttpSecurityConfigurer;
import com.ritense.valtimo.security.config.ValtimoVersionHttpSecurityConfigurer;
import com.ritense.valtimo.security.jwt.authentication.TokenAuthenticationService;
import com.ritense.valtimo.security.matcher.SecurityWhitelistProperties;
import com.ritense.valtimo.security.matcher.WhitelistIpRequestMatcher;
import com.ritense.valtimo.security.oauth2.OperatonIdentityBridgeHttpSecurityConfigurer;
import java.util.List;
import java.util.Optional;
import org.operaton.bpm.engine.IdentityService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointProperties;
import org.springframework.boot.actuate.autoconfigure.health.HealthEndpointProperties;
import org.springframework.boot.actuate.health.HealthEndpointGroups;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.data.repository.query.SecurityEvaluationContextExtension;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.Http403ForbiddenEntryPoint;

/**
 * HTTP Security configuration for Valtimo.
 *
 * <h2>Security Headers Baseline (U/PW.02-4, U/PW.02-5)</h2>
 * <p>Spring Security 6.x applies the following default headers to all responses:</p>
 * <ul>
 *   <li><b>X-Content-Type-Options: nosniff</b> - Prevents MIME type sniffing attacks</li>
 *   <li><b>X-XSS-Protection: 0</b> - Disabled; modern browsers use CSP instead</li>
 *   <li><b>Cache-Control: no-cache, no-store, max-age=0, must-revalidate</b> - Prevents caching of sensitive data</li>
 *   <li><b>Pragma: no-cache</b> - HTTP/1.0 cache prevention</li>
 *   <li><b>Expires: 0</b> - Cache expiration</li>
 *   <li><b>X-Frame-Options: DENY</b> - Clickjacking protection (intentionally enabled)</li>
 * </ul>
 * <p>Additional headers from CORS configuration (via valtimo.web.cors):</p>
 * <ul>
 *   <li><b>Vary: origin, access-control-request-method, access-control-request-headers</b></li>
 * </ul>
 * <p>Endpoint-specific headers:</p>
 * <ul>
 *   <li><b>Content-Disposition</b> - Set on file download endpoints (e.g., ZaakDocumentResource) for filename hints</li>
 * </ul>
 * <p>Additional security headers (via SecurityHeadersHttpSecurityConfigurer):</p>
 * <ul>
 *   <li><b>Referrer-Policy: strict-origin-when-cross-origin</b> - Controls referrer information in requests</li>
 *   <li><b>Permissions-Policy: geolocation=(), microphone=(), camera=()</b> - Restricts browser features</li>
 * </ul>
 * <p>Headers intentionally NOT sent:</p>
 * <ul>
 *   <li><b>Server</b> - Suppressed via server.server-header="" to avoid technology disclosure</li>
 *   <li><b>X-Powered-By</b> - Not added by Spring Boot / Tomcat by default</li>
 * </ul>
 */
@AutoConfiguration
@EnableWebSecurity
@EnableConfigurationProperties({SecurityWhitelistProperties.class, SecurityHeaderProperties.class})
public class HttpSecurityAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(SecurityEvaluationContextExtension.class)
    public SecurityEvaluationContextExtension securityEvaluationContextExtension() {
        return new SecurityEvaluationContextExtension();
    }

    @Bean
    @ConditionalOnMissingBean(Http401UnauthorizedEntryPoint.class)
    public Http401UnauthorizedEntryPoint http401UnauthorizedEntryPoint() {
        return new Http401UnauthorizedEntryPoint();
    }

    @Bean
    @ConditionalOnMissingBean(SpringSecurityAuditorAware.class)
    public SpringSecurityAuditorAware springSecurityAuditorAware() {
        return new SpringSecurityAuditorAware();
    }

    @Bean
    @ConditionalOnMissingBean(WhitelistIpRequestMatcher.class)
    public WhitelistIpRequestMatcher whitelistIpRequest(
        SecurityWhitelistProperties properties) {
        return new WhitelistIpRequestMatcher(properties.getHosts());
    }

    @Bean
    @ConditionalOnMissingBean(PasswordEncoder.class)
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    @ConditionalOnMissingBean(Http403ForbiddenEntryPoint.class)
    public Http403ForbiddenEntryPoint http403ForbiddenEntryPoint() {
        return new Http403ForbiddenEntryPoint();
    }

    //CORE ENDPOINT CONFIGURATION

    @Order(260)
    @Bean
    @ConditionalOnMissingBean(PingHttpSecurityConfigurer.class)
    public PingHttpSecurityConfigurer pingHttpSecurityConfigurer() {
        return new PingHttpSecurityConfigurer();
    }

    @Order(270)
    @Bean
    @ConditionalOnMissingBean(ValtimoVersionHttpSecurityConfigurer.class)
    public ValtimoVersionHttpSecurityConfigurer valtimoVersionHttpSecurityConfigurer() {
        return new ValtimoVersionHttpSecurityConfigurer();
    }

    @Order(280)
    @Bean
    @ConditionalOnMissingBean(EmailNotificationSettingsSecurityConfigurer.class)
    public EmailNotificationSettingsSecurityConfigurer emailNotificationSettingsSecurityConfigurer() {
        return new EmailNotificationSettingsSecurityConfigurer();
    }

    @Order(310)
    @Bean
    @ConditionalOnMissingBean(UserHttpSecurityConfigurer.class)
    public UserHttpSecurityConfigurer userHttpSecurityConfigurer() {
        return new UserHttpSecurityConfigurer();
    }

    @Order(320)
    @Bean
    @ConditionalOnMissingBean(TaskHttpSecurityConfigurer.class)
    public TaskHttpSecurityConfigurer taskHttpSecurityConfigurer() {
        return new TaskHttpSecurityConfigurer();
    }

    @Order(330)
    @Bean
    @ConditionalOnMissingBean(ReportingHttpSecurityConfigurer.class)
    public ReportingHttpSecurityConfigurer reportingHttpSecurityConfigurer() {
        return new ReportingHttpSecurityConfigurer();
    }

    @Order(340)
    @Bean
    @ConditionalOnMissingBean(ProcessHttpSecurityConfigurer.class)
    public ProcessHttpSecurityConfigurer processHttpSecurityConfigurer() {
        return new ProcessHttpSecurityConfigurer();
    }

    @Order(350)
    @Bean
    @ConditionalOnMissingBean(ProcessInstanceHttpSecurityConfigurer.class)
    public ProcessInstanceHttpSecurityConfigurer processInstanceHttpSecurityConfigurer() {
        return new ProcessInstanceHttpSecurityConfigurer();
    }

    @Order(380)
    @Bean
    @ConditionalOnMissingBean(ChoiceFieldHttpSecurityConfigurer.class)
    public ChoiceFieldHttpSecurityConfigurer choiceFieldHttpSecurityConfigurer() {
        return new ChoiceFieldHttpSecurityConfigurer();
    }

    @Order(390)
    @Bean
    @ConditionalOnMissingBean(AccountHttpSecurityConfigurer.class)
    public AccountHttpSecurityConfigurer accountHttpSecurityConfigurer() {
        return new AccountHttpSecurityConfigurer();
    }


    //DEFAULTS SECURITY CHAIN

    @Order(398)
    @Bean
    @ConditionalOnMissingBean(OpenApiHttpSecurityConfigurer.class)
    public OpenApiHttpSecurityConfigurer swaggerHttpSecurityConfigurer() {
        return new OpenApiHttpSecurityConfigurer();
    }

    @Order(399)
    @Bean
    @ConditionalOnMissingBean(StaticResourcesHttpSecurityConfigurer.class)
    public StaticResourcesHttpSecurityConfigurer staticResourcesHttpSecurityConfigurer() {
        return new StaticResourcesHttpSecurityConfigurer();
    }

    @Order(400)
    @Bean
    @ConditionalOnMissingBean(StatelessHttpSecurityConfigurer.class)
    public StatelessHttpSecurityConfigurer statelessHttpSecurityConfigurer() {
        return new StatelessHttpSecurityConfigurer();
    }

    @Order(405)
    @Bean
    @ConditionalOnMissingBean(SecurityHeadersHttpSecurityConfigurer.class)
    public SecurityHeadersHttpSecurityConfigurer securityHeadersHttpSecurityConfigurer(
        SecurityHeaderProperties securityHeaderProperties
    ) {
        return new SecurityHeadersHttpSecurityConfigurer(securityHeaderProperties);
    }

    @Order(410)
    @Bean
    @ConditionalOnMissingBean(CsrfHttpSecurityConfigurer.class)
    public CsrfHttpSecurityConfigurer csrfHttpSecurityConfigurer() {
        return new CsrfHttpSecurityConfigurer();
    }

    @Order(420)
    @Bean
    @ConditionalOnMissingBean(ErrorHttpSecurityConfigurer.class)
    public ErrorHttpSecurityConfigurer errorHttpSecurityConfigurer(Http403ForbiddenEntryPoint http403ForbiddenEntryPoint) {
        return new ErrorHttpSecurityConfigurer(http403ForbiddenEntryPoint);
    }

    @Order(440)
    @Bean
    @Conditional(NoOAuth2ClientsConfiguredCondition.class)
    @ConditionalOnMissingBean(JwtHttpSecurityConfigurer.class)
    public JwtHttpSecurityConfigurer jwtHttpSecurityConfigurer(
        IdentityService identityService,
        TokenAuthenticationService tokenAuthenticationService
    ) {
        return new JwtHttpSecurityConfigurer(identityService, tokenAuthenticationService);
    }

    @Order(441)
    @Bean
    @Conditional(org.springframework.boot.autoconfigure.security.oauth2.client.ClientsConfiguredCondition.class)
    @ConditionalOnMissingBean(OperatonIdentityBridgeHttpSecurityConfigurer.class)
    public OperatonIdentityBridgeHttpSecurityConfigurer operatonIdentityBridgeHttpSecurityConfigurer(
        IdentityService identityService
    ) {
        return new OperatonIdentityBridgeHttpSecurityConfigurer(identityService);
    }

    @Order(450)
    @Bean
    @ConditionalOnMissingBean(ApiLoginHttpSecurityConfigurer.class)
    public ApiLoginHttpSecurityConfigurer apiLoginHttpSecurityConfigurer() {
        return new ApiLoginHttpSecurityConfigurer();
    }

    @Order(460)
    @Bean
    @ConditionalOnMissingBean(OperatonRestHttpSecurityConfigurer.class)
    public OperatonRestHttpSecurityConfigurer operatonRestHttpSecurityConfigurer() {
        return new OperatonRestHttpSecurityConfigurer();
    }

    @Order(470)
    @Bean
    @ConditionalOnMissingBean(OperatonCockpitHttpSecurityConfigurer.class)
    public OperatonCockpitHttpSecurityConfigurer operatonCockpitHttpSecurityConfigurer(
        SecurityWhitelistProperties whitelistProperties
    ) {
        WhitelistIpRequestMatcher whitelistIpRequestMatcher = new WhitelistIpRequestMatcher(whitelistProperties.getHosts());
        return new OperatonCockpitHttpSecurityConfigurer(whitelistIpRequestMatcher);
    }

    @Order(500)
    @Bean
    @ConditionalOnMissingBean(DenyAllHttpSecurityConfigurer.class)
    public DenyAllHttpSecurityConfigurer authenticatedHttpSecurityConfigurer() {
        return new DenyAllHttpSecurityConfigurer();
    }


    @Bean
    @ConditionalOnMissingBean(CoreSecurityFactory.class)
    public CoreSecurityFactory coreSecurityFactory(
        List<? extends HttpSecurityConfigurer> httpSecurityConfigurers
    ) {
        return new ValtimoCoreSecurityFactory(httpSecurityConfigurers);
    }

    @Order(100)
    @Bean
    public SecurityFilterChain coreSecurityFilterChain(
        CoreSecurityFactory coreSecurityFactory,
        HttpSecurity httpSecurity
    ) {
        return coreSecurityFactory.createSecurityFilterChain(httpSecurity);
    }

    @Order(50)
    @Bean
    public SecurityFilterChain actuatorSecurityFilterChain(
        HttpSecurity httpSecurity,
        WebEndpointProperties webEndpointProperties,
        HealthEndpointProperties healthEndpointProperties,
        PasswordEncoder passwordEncoder,
        @Value("${spring-actuator.username}") String username,
        @Value("${spring-actuator.password}") String password
    ) {
        return new ActuatorSecurityFilterChainFactory().createFilterChain(
            httpSecurity,
            webEndpointProperties,
            healthEndpointProperties,
            passwordEncoder,
            username,
            password
        );
    }

    // Wraps the auto-configured HealthEndpointGroups so /actuator/health responses only include
    // components/details when the caller is authenticated and holds ROLE_ACTUATOR. This is a
    // code-level override of management.endpoint.health.{show-details,roles} and per-group
    // equivalents — application.yml cannot relax it. Defense-in-depth alongside the conditional
    // permitAll in ActuatorSecurityFilterChainFactory.
    @Bean
    public static BeanPostProcessor actuatorRoleHealthEndpointGroupsPostProcessor() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String beanName) {
                if (bean instanceof HealthEndpointGroups groups
                        && !(bean instanceof ActuatorRoleHealthEndpointGroups)) {
                    return new ActuatorRoleHealthEndpointGroups(groups);
                }
                return bean;
            }
        };
    }

    @Order(100)
    @Bean
    public WebSecurityCustomizer coreWebSecurityCustomizer(
        CoreSecurityFactory coreSecurityFactory
    ) {
        return coreSecurityFactory.createWebSecurityCustomizer();
    }

    @Order(Ordered.LOWEST_PRECEDENCE)
    @Bean
    @ConditionalOnMissingBean(ExceptionTranslator.class)
    public ExceptionTranslator defaultCoreExceptionTranslator(
        Optional<HardeningService> hardeningService
    ) {
        return new ExceptionTranslator(hardeningService);
    }

}
