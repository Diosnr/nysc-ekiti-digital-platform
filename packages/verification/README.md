# @nysc/verification

Isolated Call-up Letter verification adapter.

The rest of the platform depends only on the `CallUpVerificationAdapter` interface.
Concrete implementations (manual, temporary scraping, future official API) live here and can be replaced without touching PCM domain logic.

Authorization to automate against any NYSC endpoint is an external dependency and must be treated as such.
