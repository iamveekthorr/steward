# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Manage Me is a payment management system for diaspora users to manage worker payments. Users create accounts, add "links" (workers), and links invite managers who set payment amounts and structures. The system provides reminders, proof of payment tracking, and a dashboard for managing links and viewing payout statistics.

**Tech Stack:**
- Backend: Rust with Axum web framework
- Database: PostgreSQL via SQLx
- Frontend: HTMX/WASM (planned)

## Development Commands

### First-time Podman setup (macOS)

Podman requires a VM on macOS. Run these once:

```bash
# Install Podman
brew install podman podman-compose

# Initialise and start the VM
podman machine init
podman machine start
```

### Running the Application

```bash
# Start PostgreSQL
podman compose up -d

# Run the application (connects to database and starts server on port 3000)
cargo run

# Build the project
cargo build

# Build optimized release binary
cargo build --release
```

### Container management

```bash
# Stop containers (keeps volumes)
podman compose down

# Stop and remove volumes (full reset)
podman compose down -v

# View running containers
podman ps

# View PostgreSQL logs
podman logs manage_me

# Open a psql shell into the running container
podman exec -it manage_me psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}
```

### Database migrations

```bash
# Run pending migrations
sqlx migrate run

# Revert the last migration
sqlx migrate revert

# Check migration status
sqlx migrate info
```

### Database

The application connects to PostgreSQL using environment variables from `.env`:
- Database runs on `localhost:5432` (via Podman Compose)
- Connection string is constructed from: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_DB_PORT`, `POSTGRES_DB`
- App server port is configured via `APP_PORT` (default: 3000)

### Testing

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run a specific test
cargo test test_name
```

### Code Quality

```bash
# Check code without building
cargo check

# Run clippy linter
cargo clippy

# Format code
cargo fmt
```

## Architecture

### Module Structure

The application follows a modular architecture:

```
src/
├── main.rs          # Entry point: config loading, DB connection, server setup
├── app.rs           # AppState and PostgresDbPool wrapper
├── routes.rs        # Router composition (merges all route modules)
├── routes/          # HTTP route handlers
│   └── users.rs     # User endpoints (GET /users/me, GET|PATCH /users/settings)
├── models.rs        # Module exports
├── models/          # Data models and repository traits
│   ├── users_model.rs
│   ├── links.rs
│   ├── managers.rs
│   ├── payouts.rs
│   └── settings.rs
└── utils/           # Shared utilities
    └── response.rs  # ApiResponse struct for standardized HTTP responses
```

### Key Patterns

**Repository Pattern:**
- Models define repository traits (e.g., `UsersRepository` in `src/models/users_model.rs:17-20`)
- `PostgresDbPool` implements repository traits using SQLx
- Example: `UsersRepository::find_all()` and `find_by_id()` in `src/models/users_model.rs:22-35`

**State Management:**
- `AppState` holds shared application state (database pool)
- Wrapped `PostgresDbPool` provides type safety and encapsulation
- State is passed to handlers via Axum's `State` extractor

**Response Handling:**
- All API responses use `ApiResponse<T>` from `src/utils/response.rs`
- Contains: `http_status` (StatusCode), `status` (bool), `message` (String), `data` (Option<T>)
- Implements `IntoResponse` for seamless Axum integration

**Router Composition:**
- Individual route modules export their own routers
- `routes.rs` merges all route modules into a single `app_router()`
- Main app nests the router under `/api/v1/`

### Domain Model Relationships

Core entities represent the payment management workflow:

- **Users**: Diaspora users who create accounts and manage workers
- **Links**: Represents worker connections (references `user_id` and `manager_id`)
  - Contains employment details: `job_type`, `start_date`, `end_date`
  - Contains location of where the worker lives: `country` (required), `city` (optional), `state_province` (optional)
  - Status tracked via `LinkStatus` enum: `Pending`, `Active`, `Inactive`, `Suspended`, `Terminated`
- **Managers**: Set payment amounts and structures for links
- **Payouts**: Track payments made to links
- **Settings**: User-specific configuration (e.g., reminder preferences)

All models include `created_at` and optional `updated_at` timestamps using `chrono::DateTime<Utc>`.

### Database Layer

**SQLx Integration:**
- Uses compile-time checked queries (macro-based)
- All queries in repository implementations use `sqlx::query_as::<_, Dto>()` pattern
- DTOs derive `sqlx::FromRow` for automatic deserialization
- Connection pooling via `PgPool` wrapped in `PostgresDbPool`

**Data Transfer Objects (DTOs):**
- All models derive: `Serialize`, `Deserialize`, `FromRow`, `Debug`
- Use `chrono::DateTime<Utc>` for timestamps
- Field visibility: some fields (like `updated_at`) are module-private when not needed externally

## Adding New Features

### Adding a New Model

1. Create `src/models/model_name.rs` with DTO struct and repository trait
2. Add module declaration to `src/models.rs`
3. Implement repository trait for `PostgresDbPool`
4. Ensure struct derives: `Serialize`, `Deserialize`, `FromRow`, `Debug`

### Adding New Routes

1. Create `src/routes/resource.rs`
2. Define route handlers using Axum extractors (`State`, `Path`, `Json`)
3. Return `ApiResponse<T>` from handlers
4. Export router function that returns `Router<AppState>`
5. Merge router in `src/routes.rs` via `.merge(resource::router())`

### Error Handling

- Database errors are logged via `tracing::error!()` and returned as 500 responses
- Not found cases return 404 with descriptive messages
- Empty result sets may return 204 NO_CONTENT (see `get_users` handler)

## Logging

The application uses `tracing` for structured logging:
- Configured in `main.rs` with `tracing-subscriber`
- Default level: `info` (configurable via `RUST_LOG` environment variable)
- HTTP request tracing enabled via `tower-http::trace::TraceLayer`
- Use `tracing::info!()`, `tracing::error!()`, etc. for logging

## Configuration

All configuration is loaded from environment variables via `.env` file:
- Uses `dotenvy` for `.env` loading
- Uses `envy` crate for deserializing into `Config` struct
- Application exits with error if config parsing fails
- Never commit `.env` files (already in `.gitignore`)

---

## Architectural Decisions & Design Notes

**IMPORTANT:** The following sections document architectural decisions made during design discussions. These should guide implementation decisions.

### Current Implementation Issues (To Be Fixed)

1. **Type Inconsistencies (resolved)**
   - All IDs are now `UUID PRIMARY KEY DEFAULT gen_random_uuid()` in the database and `uuid::Uuid` in Rust models
   - All foreign key columns use `UUID` (not `TEXT`)

2. **Boolean Representation**
   - Current: `is_active: u8` (0 = false, 1 = true)
   - **Problem:** No type safety, can have invalid values (2, 3, etc.)
   - **Decision:** Use PostgreSQL ENUMs for multi-state fields, `bool` for true binary states
   - **Pattern:** When you need 3+ states, use typed enums instead of booleans

3. **Settings Table (EAV Anti-pattern)**
   - Current: Key-value pairs with `String` values for everything
   - **Problem:** No type safety, poor query performance, no database constraints, requires JOINs for filtering
   - **Decision:** Use typed columns in dedicated settings table (e.g., `user_settings` with explicit columns)
   - **Alternative:** Use PostgreSQL JSONB only for truly dynamic/extensible data

4. **Mixed Concerns in Payouts Model**
   - Current model mixes payment configuration (interval, frequency) with payment records (last_pay_date)
   - **Decision:** Separate into:
     - `payment_configurations` - How to pay (policy)
     - `overtime_records` - Hours worked (data)
     - `payouts` - Actual payment transactions (records)

### Corrected Domain Model

**Core Understanding:**
- **User** = Any person in the system (both diaspora managers and workers)
- **Manager** = A user who employs workers (requires verification/approval)
- **Link** = Employment relationship between a manager and a worker
- **Manager invites/creates Links** (not the other way around)

**Entity Relationships:**
```
users (all people)
  └─→ managers (one-to-one, subset of users with manager privileges)
       └─→ links (many-to-one, one manager has many employment relationships)
            ├─→ link_manager_history (audit trail of ownership transfers)
            ├─→ payment_configurations (versioned payment settings)
            ├─→ overtime_records (hours worked per period)
            └─→ payouts (payment transactions)
```

**Why Separate Managers Table:**
- Required for auditability in financial systems
- Tracks verification status (pending, verified, suspended, revoked)
- Records who verified the manager and when
- Supports business registration and compliance requirements
- Enables manager-specific policies and settings
- Tracks authorization periods (when someone had authority to employ)

### Critical Requirement: Link Transfers Between Managers

**Use Cases:**
1. Business sale (Manager A sells all workers to Manager B)
2. Inheritance (Manager passes away, heir takes over)
3. Worker switches employers voluntarily
4. Organizational restructuring

**Audit Requirements:**
- Complete history of who managed a link and when
- Worker consent tracking for each transfer
- Legal documentation (transfer agreements, death certificates)
- Payment config changes tied to manager changes
- Ability to answer: "Who was the manager on date X?"

**Implementation Pattern:**
```rust
// Current state in links table
Link {
    current_manager_id: String,  // Current owner
    worker_user_id: String,
}

// Complete history in separate table
LinkManagerHistory {
    link_id: String,
    from_manager_id: Option<String>,  // NULL for initial creation
    to_manager_id: String,
    transferred_at: DateTime<Utc>,
    transferred_by: String,  // Who authorized
    worker_consented: bool,
    effective_from: DateTime<Utc>,
    effective_until: Option<DateTime<Utc>>,  // NULL = current
}
```

### Enum Types for State Management

**When to use Enums vs Boolean:**
- **Boolean:** True binary choice (enabled/disabled, visible/hidden)
- **Enum:** 3+ states or states that may expand (status, verification level, payment method)

**Pattern - PostgreSQL Native Enum:**
```sql
CREATE TYPE link_status AS ENUM ('pending', 'active', 'inactive', 'suspended', 'terminated');
CREATE TYPE manager_status AS ENUM ('pending', 'verified', 'suspended', 'revoked');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
```

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "link_status", rename_all = "snake_case")]
pub enum LinkStatus {
    Pending,
    Active,
    Inactive,
    Suspended,
    Terminated,
}
```

**Benefits:**
- Type safety in both database and application
- Database enforces valid values
- Self-documenting schema
- Easy to query and index

### Overtime Architecture Decision

**Problem:** Overtime doesn't belong in payment configuration (config is static, overtime is dynamic)

**Solution - Hybrid Approach:**

1. **`overtime_policies` table** - Reusable policy definitions
   - Manager creates policies ("Standard 1.5x", "Weekend 2.0x")
   - Defines multipliers, max hours, calculation rules

2. **`payment_configurations.overtime_policy_id`** - Links worker to policy
   - Optional FK (not all workers get overtime)
   - References which policy applies to this worker

3. **`overtime_records` table** - Actual hours worked
   - Tracks hours per pay period
   - Separates regular/weekend/holiday overtime
   - Requires approval workflow
   - References policy used for calculation

4. **`payouts` table** - Final payment amounts
   - Includes base + overtime + other adjustments
   - Links to overtime records that were paid

**Benefits:**
- Separates policy (rules) from data (actual hours)
- Supports both salaried and hourly workers
- Enables approval workflows
- Complete audit trail
- Flexible for various overtime scenarios

### Audit Logging Pattern

**Required for Compliance:**

```rust
pub struct AuditLog {
    pub id: String,
    pub table_name: String,  // Which table changed
    pub record_id: String,   // Which record
    pub action: String,      // create, update, delete, status_change
    pub old_values: Option<serde_json::Value>,
    pub new_values: serde_json::Value,
    pub performed_by: String,  // User ID
    pub performed_at: DateTime<Utc>,
    pub ip_address: Option<String>,
    pub reason: Option<String>,
}
```

**Also add audit fields to critical tables:**
- `created_by` - Who created the record
- `updated_by` - Who last modified
- `status_changed_by` - Who changed status
- `verified_by` - Who verified/approved

### Payment Configuration Design Principles

**Configurable per User means:**
- Each Link (employment relationship) can have unique payment settings
- Settings should be versioned (track changes over time)
- Configuration includes:
  - Base salary or hourly rate
  - Currency
  - Payment frequency (weekly, biweekly, monthly)
  - Payment day
  - Reference to overtime policy (if applicable)
  - Valid from/until dates (temporal tracking)

**When manager transfers, payment config:**
- Old config gets `valid_until` set to transfer date
- New manager must set new config (or inherit/modify existing)
- Payout records reference which config version was active

### Database Design Anti-Patterns to Avoid

1. **EAV (Entity-Attribute-Value)** - Key-value pairs for structured settings
2. **Using integers for enums** without constraints - Use PostgreSQL ENUMs
3. **Mixing current state with history** in same table - Separate current from history
4. **Boolean proliferation** - Use enums when you have 3+ states
5. **No audit trail** - Always track who/when for financial data

### Next Steps (Implementation Checklist)

Before implementing new features:

1. ✅ Fix ID type consistency (standardize on String/TEXT)
2. ✅ Replace `u8` booleans with proper `bool` or enum types
3. ✅ Refactor managers model (ensure one-to-one with users)
4. ✅ Separate payment configuration from payment records
5. ✅ Implement proper settings table (typed columns, not key-value)
6. ✅ Add link_manager_history table for transfer tracking
7. ✅ Add audit_log table for comprehensive change tracking
8. ✅ Add created_by/updated_by fields to all important tables
9. ✅ Implement overtime architecture (policies + records)
10. ✅ Set up database migrations using `sqlx migrate`
11. ✅ Add worker location (`country`, `city`, `state_province`) to `links` table

### Planned — Not Yet Implemented

- **Subscription model**: The application will require managers to hold an active subscription to use the platform. This adds a `subscriptions` table, billing state, and access-gating middleware. Architecture is intentionally deferred — implement only after core payment management flows are stable.

### Key Queries to Support

The schema should efficiently support:
- "Show all workers for a manager" (with payment details)
- "Who was the manager on specific date?" (temporal query)
- "Show transfer history for a link" (audit trail)
- "Find all unverified managers with active links" (compliance)
- "Calculate total monthly payout for a manager" (dashboard)
- "Show payment history with proof of payment" (records)
- "Find transfers without worker consent" (compliance audit)
- "Track who changed what and when" (audit log queries)
