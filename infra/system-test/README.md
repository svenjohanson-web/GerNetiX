# GerNetiX system-test infrastructure

This directory defines a disposable, isolated foundation for load, browser,
device and fault-injection tests. It does not connect to development, staging
or production services.

## Safety contract

- Both networks are Docker-internal. The few host ports required by local test
  runners are published exclusively on numeric IPv4 loopback (`127.0.0.1`),
  never on a LAN- or internet-reachable interface.
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

The dependency paths used inside Compose and by host-side test runners are:

| Dependency | Direct in Compose | Proxied in Compose | Direct from host | Proxied from host |
| --- | --- | --- | --- | --- |
| PostgreSQL | `postgres:5432` | `toxiproxy:15432` | `127.0.0.1:55432` | `127.0.0.1:55433` |
| MQTT | `mosquitto:1883` | `toxiproxy:11883` | `127.0.0.1:51883` | `127.0.0.1:51884` |
| Forgejo | `forgejo:3000` | `toxiproxy:13000` | `http://127.0.0.1:53000` | `http://127.0.0.1:53001` |

Toxiproxy's control API is available at `http://toxiproxy:8474` inside
`control-plane` and at `http://127.0.0.1:58474` for the host-side orchestrator.
The latter is the default used by `tools/system-tests/chaos`; it is not
reachable through another host interface.

The fixed high host ports intentionally avoid the common development ports.
A port conflict must fail startup visibly; do not broaden a binding or silently
fall back to another interface.

## Static verification

The checks do not start containers or pull images:

```sh
node --test infra/system-test/compose.contract.test.js
```

When the Docker Compose CLI is installed, the same test also runs
`docker compose config --quiet` with synthetic validation values.
