# Security Specification for Memory Island

## 1. Data Invariants
- Users can only read and write their own profile data.
- Public islands and archipelagos are read-only for all authenticated users (list/get).
- Only the author of a public island or archipelago can create/update/delete it.
- Downloads count on public resources can be incremented by anyone importing them (via specific update action).
- All IDs must match '^[a-zA-Z0-9_\\-]+$'.
- Timestamps must be server-validated.

## 2. The "Dirty Dozen" Payloads (Examples)
1. **Identity Spoofing**: Attempt to create a user profile with a UID that doesn't match `auth.uid`.
2. **Shadow Field**: Update an island with an extra field `isAdmin: true`.
3. **Ghost Import**: Directly update a public island's `authorId` to the current user.
4. **Outcome Jumping**: Change a card's `color_score` to 1000.
5. **PII Leak**: Attempt to list all user profiles (should be restricted to owner).
6. **ID Poisoning**: Create an island with a 2KB junk string as the ID.
7. **Resource Poisoning**: Upload a 1MB string into a card's `front` field.
8. **Relational Break**: Create an island with an `archipelagoId` that doesn't exist.
9. **Timestamp Fraud**: Set `publishedAt` to a future date from the client.
10. **Global Write**: Attempting `allow write: if true` via a wildcard bypass.
11. **Download Inflation**: Update `downloads` by 1,000,000 in one request.
12. **Verified Bypass**: Writing data with an unverified email (if verification required).

## 3. Test Runner (Conceptual)
Tests will verify that these payloads return PERMISSION_DENIED.
