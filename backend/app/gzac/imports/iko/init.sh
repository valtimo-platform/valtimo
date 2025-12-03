#!/bin/bash

echo ">>>>  Starting IKO data import script  <<<<"

sh /docker-entrypoint-initdb.d/database/fill-data-on-startup.sh  &
