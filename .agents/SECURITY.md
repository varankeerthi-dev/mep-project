# ERP Security Authority

## Core security model

Security boundaries are enforced by architecture and database controls, not by UI behavior.

Primary concerns:

- authentication;
- organization/tenant isolation;
- authorization;
- RLS;
- privileged RPC/server operations;
- least privilege;
- auditability;
- AI-agent tool boundaries.

## Tenant isolation

Every tenant-owned record must have an enforceable organization boundary.

For every new/changed data path verify:

- authenticated identity;
- organization membership;
- role/permission;
- RLS;
- server-side authorization where required;
- protection against cross-tenant access.

Never trust a client-supplied `organization_id` as a security control.

## RLS

RLS is a core database security boundary.

For affected tables, inspect the actual live policies for:

- SELECT;
- INSERT;
- UPDATE;
- DELETE;
- organization membership;
- role restrictions;
- privileged paths.

Do not weaken RLS for implementation convenience.

## Privileged operations

RPCs/functions that perform elevated or multi-step operations must be evaluated for:

- invoker/definer behavior;
- authorization;
- tenant context;
- parameter manipulation;
- data scope;
- cross-tenant exposure;
- auditability.

## Client writes

Client-side writes are not automatically unsafe, but business-critical mutations must be evaluated for atomicity and authorization.

Do not implement critical transitions as a browser-controlled sequence when a partial failure could corrupt business state.

## AI agents

AI agents are first-class identities with explicit permissions.

An agent must have:

- tenant context;
- explicit role/authorization;
- bounded tools;
- least privilege;
- auditable actions where required.

AI agents must not receive unrestricted database access.

The established product boundary is that AI agents can perform permitted operational actions such as creating/updating tasks or permitted business records, but must not silently delete business data.

## Security verification

For sensitive features verify:

- same-tenant authorized access;
- cross-tenant denial;
- role denial;
- forged/mismatched identifiers;
- unauthorized RPC invocation;
- repeated requests where relevant;
- partial-failure behavior where relevant.

## Security evidence

Never claim a security boundary is safe merely because a UI or TypeScript type suggests it.

Inspect the actual RLS/function/database behavior.
