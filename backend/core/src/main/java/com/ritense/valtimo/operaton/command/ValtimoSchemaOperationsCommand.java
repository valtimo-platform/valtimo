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

package com.ritense.valtimo.operaton.command;

import com.ritense.valtimo.contract.bootstrap.BootstrapState;
import com.ritense.valtimo.contract.config.LiquibaseRunner;
import java.sql.SQLException;
import org.operaton.bpm.engine.SchemaOperationsCommand;
import org.operaton.bpm.engine.impl.db.PersistenceSession;
import org.operaton.bpm.engine.impl.db.sql.DbSqlSession;
import org.operaton.bpm.engine.impl.interceptor.CommandContext;
import org.slf4j.Logger;

public class ValtimoSchemaOperationsCommand implements SchemaOperationsCommand {

    private static final Logger logger = org.slf4j.LoggerFactory.getLogger(ValtimoSchemaOperationsCommand.class);
    private final LiquibaseRunner liquibaseRunner;
    private final boolean bootstrapEnabled;
    private final BootstrapState bootstrapState;

    public ValtimoSchemaOperationsCommand(
        LiquibaseRunner liquibaseRunner,
        boolean bootstrapEnabled,
        BootstrapState bootstrapState
    ) {
        this.liquibaseRunner = liquibaseRunner;
        this.bootstrapEnabled = bootstrapEnabled;
        this.bootstrapState = bootstrapState;
    }

    @Override
    public Void execute(CommandContext commandContext) {
        if (!bootstrapEnabled) {
            logger.info("Bootstrap disabled (valtimo.bootstrap.enabled=false); skipping Operaton schema migration");
            return null;
        }

        try {
            PersistenceSession persistenceSession = commandContext.getSession(PersistenceSession.class);
            persistenceSession.dbSchemaUpdate();

            // TODO: not this
            if (persistenceSession instanceof DbSqlSession) {
                ((DbSqlSession) persistenceSession).getSqlSession().getConnection().commit();
            }
            persistenceSession.close();

            liquibaseRunner.run();
        } catch (RuntimeException e) {
            recordFailure(e);
            throw e;
        } catch (Exception e) {
            recordFailure(e);
            throw new RuntimeException("Error running liquibaseRunner", e);
        }
        logger.debug("Operaton schema updated");
        return null;
    }

    private void recordFailure(Throwable cause) {
        if (bootstrapState != null) {
            bootstrapState.markFailed("operaton-schema", cause);
        }
    }

}