Title: Show HN: Orqenix Phase 6 - Local-first mesh transport for AI agent orchestration

Hey HN. Orqenix Phase 6 just shipped to npm with the mesh transport layer for multi-agent AI systems.

What it is:
- MeshTransport abstraction: HTTP (node:http + undici) and js-libp2p (TCP + WebSockets + Noise XX + yamux)
- Ed25519 capability tokens, sub-millisecond verification
- mDNS local discovery + bootstrap.yaml, no DHT
- W3C traceparent, OpenTelemetry metrics
- Cross-transport routing with circuit breaker + failover

What it is not: prompt-chaining, single-agent runtime, workflow engine.

Key decisions: js-libp2p only (Rust via NAPI-RS deferred to Phase 7 Pro), mDNS local-first, WebCrypto Ed25519.

Install: npm install -g @orqenix-pro/cli@^0.6.4 orqenix help

github.com/milosaysyolo/Orqenix (OSS, Apache 2.0) github.com/milosaysyolo/Orqenix-Pro (Pro, BUSL 1.1)
