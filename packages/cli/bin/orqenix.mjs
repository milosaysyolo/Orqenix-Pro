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
import { PolyglotBackendManager } from '@orqenix-pro/polyglot-backend';
import { RouterRouteProbe } from './route-probe-default.mjs';
import { DefaultAuditLog } from './audit-log-default.mjs';
import { DefaultDelegationStore } from './delegation-store-default.mjs';
import { DefaultBlastRadiusStore } from './blast-radius-default.mjs';

const verifier = new ProLicenseVerifier();
const audit = new DefaultAuditLog();
const delegStore = new DefaultDelegationStore();
const quotaStore = new DefaultBlastRadiusStore('local');
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
