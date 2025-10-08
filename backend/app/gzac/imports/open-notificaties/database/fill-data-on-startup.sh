#!/bin/bash

echo ">>>>  Waiting until Open Notificaties has initialized the database <<<<"
useradd notifications
while true
do
    verifier=$(psql -U notifications -d notifications -t -A -c "select count(id)>0 from auth_permission")
    if [ "t" = $verifier ]
        then
            echo "Running database setup scripts"
            for file in /docker-entrypoint-initdb.d/database/*.sql
            do
                echo "Running $file"
                psql -U notifications notifications -f $file
            done
            break
        else
            echo "Open Notificaties is not running yet"
            sleep 5
    fi
done
