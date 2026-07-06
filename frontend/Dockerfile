FROM nginxinc/nginx-unprivileged:1.28-alpine

# Which Angular app variant to package. Match the `ng build <variant>` name:
# `dev` (default for local-dev images), `gzac`, etc.
ARG VARIANT=dev

COPY --chown=1000:1000 ./deployment/${VARIANT}/browser /usr/share/nginx/html
COPY ./conf/default.conf /etc/nginx/conf.d/default.conf

USER 1000

# When the container starts, replace the env.js with values from environment variables
CMD ["/bin/sh",  "-c",  "envsubst < /usr/share/nginx/html/assets/config.template.js > /usr/share/nginx/html/assets/config.js && exec nginx -g 'daemon off;'"]

EXPOSE 8080
