#!/bin/bash

echo ">>>>  Starting Open Zaak data import script  <<<<"

sh /docker-entrypoint-initdb.d/database/fill-data-on-startup.sh  &
