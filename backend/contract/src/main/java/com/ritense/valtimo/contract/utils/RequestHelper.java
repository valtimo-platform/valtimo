/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.contract.utils;

import jakarta.servlet.http.HttpServletRequest;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

public class RequestHelper {
    private static final Logger logger = LoggerFactory.getLogger(RequestHelper.class);
    public static final String TIMEZONE_OFFSET_HEADER = "X-Timezone-Offset";

    private RequestHelper() {
    }

    public static String getOrigin() {
        Set<String> ipList;
        try {
            HttpServletRequest httpServletRequest = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
            ipList = IpUtils.extractSourceIpsFrom(httpServletRequest);
        } catch (Exception e) {
            ipList = Set.of("unknown");
        }
        return ipList.toString();
    }

    /**
     * This method retrieves the ZoneOffset from the X-Timezone-Offset header.
     * When the header is not present, UTC is returned.
     *
     * @return ZoneOffset
     */
    public static ZoneOffset getZoneOffset() {
        return getRequestZoneOffset().orElse(ZoneOffset.UTC);
    }

    /**
     * This method retrieves the ZoneOffset from the TIMEZONE_OFFSET_HEADER header, if present and valid.
     */
    public static Optional<ZoneOffset> getRequestZoneOffset() {
        ZoneOffset zoneOffset = null;

        try {
            RequestAttributes attribs = RequestContextHolder.getRequestAttributes();

            if (attribs != null) {
                HttpServletRequest request = ((ServletRequestAttributes) attribs).getRequest();
                String zoneOffsetHeader = request.getHeader(TIMEZONE_OFFSET_HEADER);

                if (StringUtils.isNotBlank(zoneOffsetHeader)) {
                    zoneOffset = ZoneOffset.of(zoneOffsetHeader);
                }
            }

        } catch (Exception e) {
            logger.error(e.getMessage(), e);
        }

        return Optional.ofNullable(zoneOffset);
    }
}