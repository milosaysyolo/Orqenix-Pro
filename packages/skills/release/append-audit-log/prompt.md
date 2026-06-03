# append-audit-log

Append BLAKE3 hash-chained entry to release audit log.

## Input
- logPath: path to audit log file
- entry: AuditEntry object

## Output
Entry hash, previous hash, chain position.

## Verify function
verifyChain(logPath): check chain integrity, return tamperedAt position if broken.
