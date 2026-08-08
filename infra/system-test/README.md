# GerNetiX system-test infrastructure

This directory defines a disposable, isolated foundation for load, browser,
device and fault-injection tests. It does not connect to development, staging
or production services.

## Safety contract

- Both networks are Docker-internal and no service publishes a host port.
- Compose-scoped volumes and resources carry `com.gernetix.scope=system-test`.
- Startup stops unless the two explicit system-test guard values match.
- Forgejo registration, SSH, hooks, webhooks, Actions and external integrations
  are disabled.
- PostgreSQL contains separate `gernetix_runtime` and `forgejo` databases and
  denies the Forgejo login access to `gernetix_runtime`.
- MQTT anonymous access exists only inside the isolated data-plane network. It
  is intentionally not a model for staging or production security.
- `docker compose down --volumes` is valid only for this disposable project.
  Never apply that command to another Compose project.

Copy `.env.example` to a separate local env file, replace all synthetic secret
placeholders, and use an explicit unique Compose project name for every run.
Do not reuse `.env.vps`, staging credentials or production credentials.

The dependency paths used by later test runners are:

| Dependency | Normal address | Fault-injectable address |
| --- | --- | --- |
| PostgreSQL | `postgres:5432` | `toxiproxy:15432` |
| MQTT | `mosquitto:1883` | `toxiproxy:11883` |
| Forgejo | `forgejo:3000` | `toxiproxy:13000` |

Toxiproxy's control API is available only inside `control-plane` at
`http://toxiproxy:8474`. Test orchestrators that inject faults must join that
network explicitly.

## Static verification

The checks do not start containers or pull images:

```sh
node --test infra/system-test/compose.contract.test.js
```

When the Docker Compose CLI is installed, the same test also runs
`docker compose config --quiet` with synthetic validation values.
