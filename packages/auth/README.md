# @nysc/auth

Password hashing, JWT access/refresh tokens, and permission-check helpers.

**Rule:** Menu visibility is not security. Every protected API/service must call `hasPermission` (or equivalent) independently.
