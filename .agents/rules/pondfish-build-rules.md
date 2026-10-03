# PondFish — Strict Build Rules

## 1. PURPOSE

This project is a complete rebuild of the PondFish Digital Ecosystem.

The existing PondFish documentation is the functional and product specification.

The existing implementation is NOT the implementation baseline.

The coding agent MUST read and understand the relevant documentation before implementing any feature.

The agent must not introduce functionality, architecture, technology, libraries, services, patterns, or features that are not required by the documentation or explicitly requested by the project owner.

This is a controlled implementation environment.

Do not generalize the project.
Do not expand the project.
Do not add "nice to have" features.
Do not invent missing requirements.
Do not silently replace specified requirements.

---

# 2. DOCUMENTATION IS THE PRIMARY PRODUCT SOURCE

The entire `Documentation/` directory is part of the project source.

Before implementing a feature, the agent MUST:

1. Locate all documentation relevant to that feature.
2. Read the complete relevant sections.
3. Understand the business rules.
4. Understand the UI requirements.
5. Understand the data requirements.
6. Understand the API/integration requirements.
7. Understand dependencies on other modules.
8. Determine the required implementation boundary.
9. Only then implement the feature.

Do NOT implement a feature based on one isolated paragraph when related documentation exists elsewhere.

For cross-system features, the agent MUST inspect all relevant documentation sections before implementation.

Example:

A booking feature may require reading:
- Master PRD
- Core Business Engines
- API specification
- Database specification
- Customer UI specification
- Worker UI specification
- Admin UI specification
- Validation/Error specification
- Integration specification
- Design system

The agent must read the complete relevant sections before coding.

---

# 3. DOCUMENTATION TRACEABILITY IS MANDATORY

For every implementation phase, the agent must explicitly record where the implementation requirements came from.

Before implementation, produce a short traceability record:

FEATURE:
<feature name>

DOCUMENT SOURCES:
- <document filename>
- <section>
- <document filename>
- <section>

REQUIREMENTS USED:
- <requirement>
- <requirement>
- <requirement>

IMPLEMENTATION DECISIONS:
- <decision>
- <decision>

NOT USED FROM DOCUMENTATION:
- <old technology/implementation detail intentionally excluded>

This traceability information must remain associated with the implementation work.

The agent must never claim that a requirement came from the documentation unless it actually found it there.

---

# 4. SOURCE OF TRUTH

The project's business/product source of truth is the documentation placed inside:

`/Documentation`

When documentation conflicts, use the documented authority hierarchy unless the project owner explicitly overrides it.

Existing documentation establishes an authority hierarchy headed by the API/backend contract, followed by the Master PRD, Core Business Engines, System Architecture, Database/ERD, integrations, validation, design system, page specifications, frontend architecture, QA, DevOps, and Master AI Coding Prompt.

However, technology decisions explicitly overridden by these new build rules MUST NOT be implemented merely because they appear in older documentation.

Business requirements and technology choices must therefore be treated separately.

---

# 5. OLD IMPLEMENTATION TECHNOLOGY MUST NOT BE COPIED

The documentation contains implementation details from the previous PondFish architecture.

Some of those technologies are intentionally obsolete for this rebuild.

The agent MUST NOT automatically reproduce the old technology stack.

In particular, the agent must IGNORE old implementation directives involving:

- Node.js backend architecture
- Express
- TypeScript backend implementation
- Prisma ORM
- Vite where Next.js is explicitly required by this rebuild
- Supabase application services
- old frontend architecture
- old project structure
- old implementation patterns
- old code organization

These may be referenced in documentation for understanding previous architecture, but they are NOT authorization to implement them.

The agent must extract the underlying requirement/business behavior and implement it using the NEW locked stack defined below.

---

# 6. NEW LOCKED TECHNOLOGY STACK

The following stack is mandatory for this rebuild.

## Web

Use:

- Next.js
- React as required by Next.js
- JavaScript
- HTML
- CSS
- PostgreSQL

Do not introduce another frontend framework.

Do not introduce another web framework.

Do not replace Next.js with Vite.

Do not create a separate generic frontend framework layer.

Use standard web technologies wherever possible.

---

# 7. CUSTOMER MOBILE APPLICATION

The customer application MUST remain a real native React Native application.

React Native is NOT to be disabled, removed, or replaced with a web wrapper.

Use:

- React Native
- JavaScript/React Native-compatible project structure as explicitly defined for this rebuild
- Native Android application
- Android-first development
- JDK 17-compatible Android/RN toolchain

The application MUST NOT be:

- a WebView wrapper
- a Next.js website packaged as an application
- a browser-based mobile shell
- a hybrid website pretending to be a native application

Use actual React Native components and native mobile capabilities.

---

# 8. JDK 17 COMPATIBILITY

The Customer React Native Android application MUST remain compatible with JDK 17.

Before selecting React Native, Android Gradle Plugin, Gradle, Android SDK, or related native dependencies, the agent must verify their compatibility with JDK 17.

Do not introduce a dependency that requires a different JDK unless explicitly approved.

JDK 17 is a project constraint.

Do not silently move the project to JDK 21 or another Java version.

---

# 9. DATABASE

The authoritative database is PostgreSQL.

The existing PondFish PostgreSQL/Supabase database and its existing tables are to be treated as the database resource to connect to.

The new application must connect to the existing PostgreSQL database rather than automatically creating a replacement database.

Do not redesign the database schema merely for convenience.

Do not create duplicate tables when the documented/existing authoritative tables already represent the required data.

Do not introduce a second database.

Do not introduce SQLite as a substitute.

Do not introduce MongoDB or another database.

---

# 10. SUPABASE

Supabase is NOT the application architecture.

The project may use the existing Supabase-hosted PostgreSQL database as the PostgreSQL infrastructure/database source.

The application must NOT depend on Supabase application services unless explicitly required and approved.

Do not use:

- Supabase Auth
- Supabase Edge Functions
- Supabase Storage
- Supabase Realtime
- Supabase business logic
- Supabase-specific application architecture

PostgreSQL is the database.

Supabase is only the existing PostgreSQL hosting/infrastructure connection where applicable.

---

# 11. OTP

OTP authentication MUST use Firebase OTP.

Do not create a replacement custom OTP system.

Do not implement mock OTP behavior.

Do not use Supabase Auth for OTP.

Do not create another authentication provider.

Firebase Authentication/OTP is the designated OTP authentication mechanism for this rebuild.

Any OTP-related implementation must follow the documented PondFish authentication and security requirements in addition to this provider decision.

---

# 12. NOTIFICATIONS

Firebase is the notification provider.

Use Firebase Cloud Messaging for push notifications where the documentation requires push notifications.

Do not introduce another notification provider.

Do not create a second notification system.

Business events may originate from the application's authoritative business logic, but delivery of mobile push notifications must use the designated Firebase notification infrastructure.

---

# 13. NO TECHNOLOGY DRIFT

The agent MUST NOT introduce technology simply because it is familiar, convenient, popular, or considered "best practice".

Do not add:

- NestJS
- Express
- FastAPI
- Django
- Laravel
- MongoDB
- Prisma
- Supabase Auth
- Supabase Realtime
- Redux unless explicitly required
- GraphQL unless explicitly required
- another ORM unless explicitly approved
- another CSS framework unless explicitly approved
- another mobile framework
- another frontend framework
- another backend framework

Do not add libraries merely to solve small problems that can be solved with the existing stack.

If a dependency is genuinely required by the documented feature, identify it and explain its purpose before adding it.

---

# 14. NO GENERIC FEATURES

Implement only what is required.

The agent MUST NOT add:

- generic dashboards
- generic CRUD generators
- generic admin systems
- generic notification centers
- generic analytics
- generic search systems
- generic settings systems
- generic permission systems
- generic feature flags
- generic CMS functionality
- generic abstractions without a concrete PondFish requirement

Every feature must have a documented or explicitly requested reason to exist.

---

# 15. NO FEATURE INVENTION

If the documentation does not specify a feature, do not invent it.

If the documentation leaves a requirement genuinely ambiguous:

1. identify the ambiguity;
2. identify the relevant documentation;
3. do not silently invent behavior;
4. ask the project owner when the ambiguity affects implementation.

Do not fill missing requirements with generic industry assumptions.

---

# 16. BUSINESS LOGIC

Business logic must be implemented centrally.

UI components must not become the source of truth for:

- inventory
- pricing
- discounts
- subscription credit
- weekly quantity
- booking eligibility
- payment state
- transaction state
- booking state
- GPS publication state
- notification state
- financial calculations
- inventory reservation
- ledger mutations

The same business rule must not be independently reimplemented in multiple portals.

---

# 17. SINGLE BUSINESS SOURCE

There must be one authoritative implementation of each business rule.

Different applications may have different UI implementations, but they must consume the same business behavior/contracts.

Do not create:

`customer business logic`

and a different:

`worker business logic`

and a different:

`admin business logic`

for the same rule.

The business rule must have one authoritative implementation.

---

# 18. PORTAL SEPARATION

The UI/application surfaces remain separate.

The project may contain:

- Public Website
- Customer Mobile Application
- Worker Portal
- Admin Portal
- Transaction TV Portal

Each surface may have its own UI, navigation, screens, and presentation.

However, they must not create independent versions of the same business rules.

---

# 19. CUSTOMER MOBILE UI

The customer mobile UI is being rebuilt.

The existing customer UI must not be treated as the final UI.

The new UI should follow the PondFish documentation and the newly requested Blinkit-inspired interaction model.

Important:

This means interaction patterns such as:

- fast browsing
- strong product discovery
- prominent search
- quick category access
- compact product cards
- fast add-to-cart interactions
- clear availability
- clear active-order status
- strong bottom navigation

may be used where they fit the PondFish requirements.

Do NOT copy Blinkit's branding, proprietary assets, or exact visual design.

PondFish's own design system and business requirements remain authoritative.

---

# 20. NO UI FEATURE EXPANSION

Changes to the mobile UI must be limited to:

1. documented PondFish requirements;
2. explicitly requested UI changes;
3. required technical implementation.

Do not use the UI redesign as an excuse to introduce new product functionality.

---

# 21. BUILD BACKEND + FRONTEND TOGETHER

Do not build the entire frontend first.

Do not build the entire backend first.

Implement the ecosystem as vertical feature slices.

Example:

Authentication:
- database connection
- authentication implementation
- API/service boundary
- customer mobile authentication UI
- required web authentication UI
- Firebase OTP
- session handling

Then move to the next feature.

Each feature should become an integrated working part of the ecosystem before moving forward.

---

# 22. DOCUMENTATION-FIRST FEATURE EXECUTION

For each feature:

STEP 1
Locate all relevant documentation.

STEP 2
Read the complete relevant sections.

STEP 3
Extract requirements.

STEP 4
Identify dependencies.

STEP 5
Identify which old implementation details must be ignored.

STEP 6
Create the implementation traceability record.

STEP 7
Implement database/API/business/UI pieces required for that feature.

STEP 8
Review the implementation against the documentation.

STEP 9
Commit the changes to Git.

STEP 10
Continue to the next feature.

---

# 23. NO TESTING DURING ECOSYSTEM BUILD

Testing is intentionally postponed.

During the ecosystem construction phase:

DO NOT:

- create unit tests
- create integration tests
- create E2E tests
- run automated test suites
- add test frameworks
- spend implementation cycles on test infrastructure
- stop feature implementation to create tests

The complete ecosystem will be built first.

Testing/QA will begin only after the complete ecosystem implementation phase has been declared complete.

IMPORTANT:

This does NOT mean ignoring obvious implementation errors.

The agent must still:

- inspect code
- inspect imports
- inspect syntax
- inspect types where applicable
- inspect configuration
- inspect database queries
- inspect integration contracts
- inspect build configuration

But it must not establish a test-driven development process during the ecosystem build.

---

# 24. GIT IS MANDATORY

Git is the single implementation history.

Every meaningful implementation change MUST be tracked.

Do not work outside Git history.

Before implementation begins:

- initialize/use the NEW Git repository
- establish the initial baseline commit

During implementation:

- make focused commits
- do not accumulate large untracked changes
- do not rewrite history unnecessarily
- do not delete history to hide implementation changes

Every feature or meaningful implementation stage must produce a Git commit.

---

# 25. GIT TRACEABILITY

Every commit must clearly explain what changed.

Preferred format:

`feat(customer): implement authentication flow`

`feat(catalogue): implement fish browsing`

`feat(booking): implement online booking`

`feat(admin): implement inventory management`

Where useful, include documentation references in the commit body:

```text
Source:
- PondFish_Master_PRD_v2.md — Section X
- PondFish_Core_Business_Engines_Specification_v1.md — Section Y
- PondFish_Page_By_Page_UI_Specification_Customer_React_Native_App.md — Section Z
```
