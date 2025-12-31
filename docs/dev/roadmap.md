# Kioku Development Roadmap

## Use Hono RPC Type Inference for API Response Types

Replace manually defined API response types with Hono's `InferResponseType` for automatic type derivation from server.

**Background:**
- Hono's `hc` client can automatically infer response types from server definitions
- Manual type definitions (`AuthResponse`, `User`) duplicate server types and can become out of sync

**Scope:**
- `AuthResponse` → Use `InferResponseType`
- `User` → Derive from `AuthResponse["user"]`
- `ApiError` → Keep (error responses are separate from success types)
- `Tokens` → Keep (client-internal type)

### Phase 1: Update API Client Types

- [x] Modify `src/client/api/client.ts`:
  - Import `InferResponseType` from `hono/client`
  - Define `LoginResponse` type using `InferResponseType<typeof rpc.api.auth.login.$post>`
  - Update `login` method to use inferred type
- [x] Modify `src/client/api/types.ts`:
  - Remove `AuthResponse` and `User` interfaces
  - Keep `ApiError` and `Tokens`
- [x] Modify `src/client/api/index.ts`:
  - Export inferred types from `client.ts` instead of `types.ts`

### Phase 2: Update Consumers

- [x] Modify `src/client/stores/auth.tsx`:
  - Import `User` type from new location (derived from login response)
  - Update `AuthState` interface

### Phase 3: Update Tests

- [x] Update `src/client/api/client.test.ts` if needed
- [x] Update `src/client/stores/auth.test.tsx` if needed
- [x] Verify all tests pass
