#!/bin/bash

echo ">>>>  Waiting until Open Formulieren has initialized the database <<<<"
useradd openforms
while true
do
    verifier=$(psql -U openforms -d openforms -t -A -c "select count(id)>0 from auth_permission")
    if [ "t" = $verifier ]
        then
            echo "Running database setup scripts"
            for file in /docker-entrypoint-initdb.d/database/*.sql
            do
                echo "Running $file"
                psql -U openforms openforms -f $file
            done
            break
        else
            echo "Open Formulieren is not running yet"
            sleep 5
    fi
done
