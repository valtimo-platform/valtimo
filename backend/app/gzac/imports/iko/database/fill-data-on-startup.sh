#!/bin/bash

echo ">>>>  Waiting until IKO has initialized the database <<<<"
#useradd iko
while true
do
    verifier=$(psql -U iko -d iko -t -A -c "select count(checksum)>22 from flyway_schema_history")
    if [ "t" = $verifier ]
        then
            echo "Running database setup scripts"
            for file in /docker-entrypoint-initdb.d/database/*.sql
            do
                echo "Running $file"
                psql -U iko -f $file
            done
            break
        else
            echo "IKO is not running yet"
            sleep 5
    fi
done
