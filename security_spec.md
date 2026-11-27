# Security Specification — Creative Ecosystem (Art Studio + UI Workshop)

## Data Invariants
1. **User Isolation**: Every cloud document (`users`, `ui_projects`, `art_documents`, `shared_assets`, `brush_packs`, `tutorial_progress`) belongs to a single verified user (`ownerId == request.auth.uid` or `uid == request.auth.uid`). No cross-user reads or list scraping are permitted.
2. **Identity Integrity**: `ownerId` and `uid` cannot be spoofed on create and are immutable on update.
3. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` on create; `createdAt` is immutable on update and `updatedAt` must equal `request.time`.
4. **Bounded Payloads**: Every string, ID, and array has strict `.size()` bounds to prevent resource exhaustion.
5. **Verified Email Gate**: Standard writes require `request.auth != null && request.auth.token.email_verified == true`.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read/write to `/ui_projects/proj_1`.
2. Creating `/ui_projects/proj_1` with `ownerId` set to another user's UID.
3. Updating `/ui_projects/proj_1` to reassign `ownerId` to another user.
4. Creating `/users/user_a` with a ghost/shadow field `isAdmin: true`.
5. Listing `/shared_assets` without `where('ownerId', '==', uid)`.
6. Reading `/users/victim_uid` as `attacker_uid` (PII isolation).
7. Creating `/art_documents/bad..id` with invalid path characters (`isValidId` failure).
8. Forging `createdAt` to a past client timestamp instead of `request.time`.
9. Updating `/art_documents/doc_1` while mutating immutable `createdAt`.
10. Sending a `shared_assets` payload with `dataUrl` exceeding 500,000 bytes.
11. Sending `brush_packs` with `brushes` list > 100 items.
12. Unverified email (`email_verified == false`) attempting to write to `/brush_packs/pack_1`.
