FROM alpine:3.22

# PocketBase is pre-1.0 and has changed incompatibly between releases: upgrade deliberately,
# read the changelog, and update the checksums below together with the version
ARG PB_VERSION=0.40.6
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip wget \
 && case "${TARGETARCH}" in \
      amd64) SHA256=0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f ;; \
      arm64) SHA256=d22c66ceb67ca92b7d767f36d826e848a276bcfa3c197ead20bf87c42208984f ;; \
      *) echo "unsupported architecture ${TARGETARCH}" && exit 1 ;; \
    esac \
 && wget -q -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
 && echo "${SHA256}  /tmp/pb.zip" | sha256sum -c - \
 && unzip /tmp/pb.zip pocketbase -d /pb \
 && rm /tmp/pb.zip

COPY pb_migrations /pb/pb_migrations

EXPOSE 8090

# migrations in /pb/pb_migrations are applied automatically on start
# --automigrate=false: schema changes made in the dashboard must not create migrations inside the container;
# make them in development (compose.dev.yaml), where the files land in git
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", \
     "--automigrate=false", "--encryptionEnv=PB_ENCRYPTION_KEY"]
