#!/usr/bin/env node
import {
  Application,
  CommandRegistry,
  AuthStatusCommand,
  MeshInspectCommand,
  makeMeshRouteCommand,
  makeDelegationChainShowCommand,
  makeDelegationRevokeCommand,
  makeQuotaShowCommand,
  makeQuotaSetCommand,
  makeQuotaResetCommand,
  makeBackendStatusCommand,
  makeBackendSwitchCommand,
} from '../dist/index.js';
import { ProLicenseVerifier } from '@orqenix-pro/license';
import { DelegationStore } from '@orqenix-pro/mesh-delegation';
import { AppendOnlyAuditLog } from '@orqenix/audit-log';
import { BlastRadiusStore } from '@orqenix-pro/blast-radius';
import { PolyglotBackendManager } from '@orqenix-pro/polyglot-backend';
import { RouterRouteProbe } from './route-probe-default.mjs';

const verifier = new ProLicenseVerifier();
const audit = new AppendOnlyAuditLog();
const delegStore = new DelegationStore();
const quotaStore = new BlastRadiusStore();
const backends = new PolyglotBackendManager();
const probe = new RouterRouteProbe();

const registry = new CommandRegistry();
registry.register(AuthStatusCommand);
registry.register(MeshInspectCommand);
registry.register(makeMeshRouteCommand({ probe }));
registry.register(makeDelegationChainShowCommand({ store: delegStore }));
registry.register(makeDelegationRevokeCommand({ store: delegStore, audit }));
registry.register(makeQuotaShowCommand({ store: quotaStore }));
registry.register(makeQuotaSetCommand({ store: quotaStore, audit }));
registry.register(makeQuotaResetCommand({ store: quotaStore, audit }));
registry.register(makeBackendStatusCommand({ manager: backends }));
registry.register(makeBackendSwitchCommand({ manager: backends, audit }));

const app = new Application({ registry, verifier });
process.exit(await app.run(process.argv.slice(2)));
