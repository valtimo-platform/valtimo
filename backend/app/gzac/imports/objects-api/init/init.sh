#!/bin/bash

c=0
while ! curl http://objecten-api:8000
do
    c=$((c+1))
    if [ "$c" = "12" ]; then
        break
    fi
    sleep 10
done

python /app/src/manage.py loaddata demodata
echo "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('admin', 'admin@example.org', 'admin')" | python /app/src/manage.py shell
