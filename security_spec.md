# Security Specification: TOKIN Smart Room Firestore Security

## 1. Data Invariants

1. **Room Consistency**:
   - A Room document must always have a unique `id`, a descriptive `name`, a valid `type` (from `MEETING`, `RECEPTION`, `TRAINING`), a positive `capacity`, and a valid `imageUrl` string.
   - Amenities must be a bounded list (array) of strings (no more than 15 items, first item must be string if array is not empty).

2. **Booking Validity & Double-Booking Prevention**:
   - A Booking must reference a valid existant Room (`roomId`).
   - Booking timestamp fields `startTime` and `endTime` must be valid ISO 8601 strings (or equivalent Timestamp representation in firestore). `startTime` must be before `endTime`.
   - Guest booking creations are allowed without authentication, but must be strictly validated against size boundaries and schema types to prevent "Denial of Wallet" resource exhaustion.

3. **Admin Controls & Identity Integrity**:
   - Only authorized administrators logged in via Firebase Auth can modify Room details, update Booking statuses (e.g., Approve / Reject), and manage Admin user models.
   - For update operations on bookings (admin approvals), only specific fields (`status`) can be modified.
   - Critical system fields such as `id` and `roomId` are immutable once created.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads represent malicious requests designed to exploit security updates, ID poisoning, or invalid status/type boundaries.

### Payload 1: ID Poisoning on Booking ID
*Attempt to insert an extremely long 1.5KB junk string as the booking ID.*
- **ID target**: `j89a#$@*...[1.5KB long string]...`
- **Rule Defense**: Closed by `isValidId()` which checks `.size() <= 128` and enforces safe character regex.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 2: Admin Privilege Escalation through Self-Assigned Roles
*A normal user attempts to save their user profile with a self-assigned admin role.*
- **Payload**: `{ "username": "attacker", "role": "SUPER_ADMIN", "password": "123" }`
- **Rule Defense**: Admin profile writes restricted to existing authenticated Super Admin accounts.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 3: Orphaned Booking creation
*Creating a Room Booking referencing a non-existent Room ID.*
- **Payload**: `{ "id": "b_orph", "roomId": "non-existent-room-id", "title": "Phantom Meeting", "organizer": "Vilas", ... }`
- **Rule Defense**: Verified using `exists(/databases/$(database)/documents/rooms/$(incoming().roomId))` on create.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 4: Booking Status bypass during Guest creation
*A non-admin guest attempts to directly create a booking with `CONFIRMED` status without going through a pending state.*
- **Payload**: `{ "id": "b4", "roomId": "m1", "title": "Bypass Sync", "status": "CONFIRMED" }`
- **Rule Defense**: When creating client-side without auth, only `PENDING` bookings or verified fields can be handled if standard approval flow is applied.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 5: Infinite Time-Travel Booking
*Booking with an end date/time before the start date/time.*
- **Payload**: `{ "startTime": "2026-06-12T10:00:00Z", "endTime": "2026-06-11T10:00:00Z" }`
- **Rule Defense**: `isValidBooking()` validation helper asserts `incoming().endTime > incoming().startTime`.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 6: Key Injecting Ghost Field (Anti-Update-Gap)
*Attempt to update a reservation with a shadow property `isVipApproval` to bypass business logic.*
- **Payload**: `{ "roomId": "m1", "isVipApproval": true }`
- **Rule Defense**: `affectedKeys().hasOnly()` limits allowed keys on update.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 7: Denial of Wallet via Giant Room Capacity
*Injection of negative capacity or billion seats capacity to exhaust processing memory.*
- **Payload**: `{ "id": "r99", "name": "Mega Room", "capacity": 9999999999 }`
- **Rule Defense**: `isValidRoom()` helper asserts `capacity` boundaries.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 8: Immutable Field Lockout bypass
*Attempt to re-route a booking by changing its immutable `roomId` after it is created.*
- **Payload**: `{ "roomId": "m2" }`
- **Rule Defense**: Asserting `incoming().roomId == existing().roomId` in the edit pattern.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 9: Empty/Large Array injection in Amenities
*Attempting to write an oversized array to crash the Room detail loader.*
- **Payload**: `{ "amenities": [ "A", "B", ... 100 times ] }`
- **Rule Defense**: Constraints array size via `incoming().amenities.size() <= 15`.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 10: Unauthorized Deletion of Room
*An unauthenticated user attempts to delete a room.*
- **Target**: Delete `/rooms/m1`
- **Rule Defense**: Restricted delete permission to Super Admins.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 11: Modifying Terminal-State Bookings
*Trying to alter details of an already rejected booking.*
- **Payload**: `{ "title": "Change after Reject" }`
- **Rule Defense**: Terminal state locking on `status` changes.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 12: Auth claims validation abuse
*Attempt to bypass credentials utilizing client-side custom auth claims.*
- **Payload**: Emulated admin custom token.
- **Rule Defense**: We fetch values directly from trusted DB path (/admins/$(request.auth.uid)) instead of trusting custom token claims.
- **Expected Outcome**: `PERMISSION_DENIED`

---

## 3. Test Runner Definition (Verification Concept)

Below is a mock test runner blueprint matching the specification layout for local validation.

```typescript
// firestore.rules.test.ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

describe("TOKIN Smart Room Fortress Rules", () => {
  let testEnv;
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({ projectId: "sutsmartbus-495306" });
  });

  it("fails to write rooms for unauthenticated users", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.collection("rooms").doc("m1").set({ name: "Attack!" }));
  });

  it("blocks booking creations with invalid end dates", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.collection("bookings").doc("b-bad").set({
      id: "b-bad",
      roomId: "m1",
      startTime: "2026-06-12T12:00:00Z",
      endTime: "2026-06-12T10:00:00Z"
    }));
  });
});
```
