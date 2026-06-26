#!/bin/bash

echo ">>>>  Waiting until Open Zaak has initialized the database <<<<"
useradd openzaak
while true
do
    verifier=$(psql -U openzaak -d openzaak -t -A -c "select count(id) from accounts_user where username = 'admin'")
    if [ "1" = $verifier ]
        then
            echo "Running database setup scripts"
            for file in /docker-entrypoint-initdb.d/database/*.sql
            do
                echo "Running $file"
                psql -U openzaak openzaak -f $file
            done
            break
        else
            echo "Open Zaak is not running yet"
            sleep 5
    fi
done
