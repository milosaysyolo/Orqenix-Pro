# Phase 6 ships: Orqenix mesh + Pro CLI now on npm

## TL;DR
After 6 sprints, all Phase 6 packages on npm with forward-compatible dependency specs:

npm install -g @orqenix-pro/cli@^0.6.4
orqenix help

## What is Phase 6?
- Transport abstraction with HTTP, libp2p (TCP + WebSockets) implementations
- Mesh discovery via mDNS + bootstrap, no DHT
- Transport security with Ed25519, capability tokens, < 1ms p95
- Observability with structured JSON logs, OTel metrics, W3C traceparent
- Cross-transport routing with priority + circuit breaker
- Pro CLI with 10 operator subcommands

## What's installed
7 OSS packages (Apache 2.0), 5 Pro packages (BUSL 1.1).

## What's next
Phase 7: multi-machine relay, browser libp2p, Web UI inspector, BYOK billing.
