# E-BARMM System Design Documentation

## Enhanced BARMM Transparency System - Complete Architecture & Design

**Client:** Ministry of Public Works - Bangsamoro Autonomous Region in Muslim Mindanao (MPW-BARMM)

**Project Basis:** Inception Report - "Updating of the Comprehensive Transparency System of MPW-BARMM through the E-BARMM System" (October 2025)

---

## DOCUMENT INDEX

This repository contains the complete system architecture and design specifications for upgrading the legacy E-BARMM system to a modern, secure, and scalable transparency platform.

### Core Design Documents

| Document | Description | Key Topics |
|----------|-------------|------------|
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture overview | Three-tier API-first design, data flows, technology stack justification, scalability, disaster recovery |
| **[DATABASE_MAPPING.md](DATABASE_MAPPING.md)** | Legacy to target schema mapping | Table-by-table migration, field transformations, UUID migration, hash chain reconstruction |
| **[API_DESIGN.md](API_DESIGN.md)** | FastAPI endpoint specifications | Authentication, RBAC, CRUD operations, append-only progress, public API, error handling |
| **[FRONTEND_DESIGN.md](FRONTEND_DESIGN.md)** | React application architecture | Component hierarchy, routing, GIS editor, progress timeline, role-based UI |
| **[MOBILE_STRATEGY.md](MOBILE_STRATEGY.md)** | Android offline-first app | SQLite schema, sync workers, GPS integration, camera capture, conflict resolution |
| **[SECURITY.md](SECURITY.md)** | Security & integrity controls | JWT authentication, RBAC, hash chaining, tamper-proof logging, encryption, audit trails |
| **[MIGRATION.md](MIGRATION.md)** | Migration execution plan | Pre-migration backup, infrastructure setup, migration scripts, validation, cutover |

---

## PROJECT OBJECTIVES (FROM INCEPTION REPORT)

The upgraded E-BARMM system MUST deliver the following capabilities:

### A. Integrated GIS Mapping
- **Current Problem:** GIS data stored as files (shapefiles/KML), not queryable
- **Solution:** Native PostGIS storage with spatial indexes, vector tile serving, web-based editing

### B. Web-Based GIS Data Editing
- **Current Problem:** No GIS editing capability, requires desktop software
- **Solution:** MapLibre-based web editor with draw tools, geofencing validation, attribute forms

### C. GIS-Aided Progress Monitoring
- **Current Problem:** Progress data disconnected from spatial features
- **Solution:** Progress logs linked to GIS features, spatial analytics, geofenced validation

### D. Tamper-Proof Progress Reporting
- **Current Problem:** Mutable progress data, no audit trail, backdating possible
- **Solution:** Append-only progress logs, SHA-256 hash chaining, database triggers, immutable audit logs

### E. Mobile Application Support
- **Current Problem:** No mobile app, field data entry requires manual transcription
- **Solution:** Android offline-first app with GPS, camera, background sync, conflict resolution

### F. Web Application Enhancements
- **Current Problem:** Legacy PHP application, poor UX, no role-based access
- **Solution:** Modern React SPA, role-based dashboards, real-time updates, responsive design

### G. Server Migration & Optimization
- **Current Problem:** MySQL with no spatial support, filesystem-based storage
- **Solution:** PostgreSQL + PostGIS, object storage (S3-compatible), vector tile caching

---

## SYSTEM ARCHITECTURE SUMMARY

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  React Web App        Public Portal        Android Mobile       │
│  (Admin/DEO)          (Read-only)          (Offline-first)      │
│                                                                  │
│  • Project CRUD       • Map viewer         • GPS capture        │
│  • GIS editor         • Search             • Camera             │
│  • Progress reports   • Statistics         • Background sync    │
│  • Media upload       • Transparency       • Offline storage    │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                     HTTPS/JSON (JWT)
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                     API LAYER                                    │
├──────────────────────────┼──────────────────────────────────────┤
│                                                                  │
│                    FastAPI Server                                │
│                    (Python 3.11+)                                │
│                                                                  │
│  • Authentication (JWT)     • Progress (append-only)            │
│  • RBAC enforcement         • GIS operations (PostGIS)          │
│  • Project CRUD             • Media (pre-signed URLs)           │
│  • Audit logging            • Public API (read-only)            │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
┌─────────────┼──────────┐  ┌──────────┼──────────────┐
│  PostgreSQL + PostGIS  │  │  Object Storage (S3)   │
│                        │  │                         │
│  • Projects            │  │  • Photos               │
│  • Progress logs       │  │  • Videos               │
│  • GIS features        │  │  • Documents            │
│  • Audit logs          │  │  • GIS exports          │
│  • Users (RBAC)        │  │                         │
│  • Hash chains         │  │  Pre-signed URLs        │
│                        │  │  for secure access      │
└────────────────────────┘  └─────────────────────────┘
```

---

## TECHNOLOGY STACK

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL 15 + PostGIS 3.4
- **ORM:** SQLAlchemy with GeoAlchemy2
- **Migrations:** Alembic
- **Authentication:** JWT (python-jose)
- **Password Hashing:** bcrypt (passlib)
- **Object Storage:** S3-compatible (MinIO or AWS S3)

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **State Management:** TanStack Query + Zustand
- **UI Framework:** Tailwind CSS + HeadlessUI
- **GIS Mapping:** MapLibre GL JS
- **GIS Editing:** @mapbox/mapbox-gl-draw
- **Routing:** React Router v6

### Mobile
- **Language:** Kotlin
- **Architecture:** MVVM + Repository Pattern
- **UI:** Jetpack Compose
- **Database:** Room (SQLite)
- **HTTP:** Retrofit
- **Background Sync:** WorkManager
- **Dependency Injection:** Hilt
- **Camera:** CameraX
- **GPS:** Google Location Services

---

## KEY ARCHITECTURAL DECISIONS

### 1. API-First Design
**Rationale:** Enables multiple clients (web, mobile, future integrations) to consume the same API, ensuring consistency and reducing duplication.

**Impact:**
- Mobile and web apps are equivalent consumers
- No direct database access from clients
- Public API subset for transparency portal
- Future integration-ready (e.g., GIS platforms)

---

### 2. Immutable Audit Trails

**Rationale:** Government transparency requires tamper-proof progress reporting to prevent backdating, data manipulation, and corruption.

**Implementation:**
- Append-only `project_progress_logs` table
- SHA-256 hash chaining (each entry hashes previous entry)
- Database triggers prevent UPDATE/DELETE operations
- Daily automated hash chain verification
- Audit logs capture all mutations

**Example:**
```
Entry 1: hash = SHA256(data1 + null)
Entry 2: hash = SHA256(data2 + hash1)
Entry 3: hash = SHA256(data3 + hash2)

Any modification breaks the chain → tampering detected
```

---

### 3. GIS-Native Storage

**Rationale:** Storing geometries in PostGIS enables spatial queries, real-time editing, and eliminates file management overhead.

**Migration:**
- **Legacy:** Shapefiles/KML stored on filesystem, referenced by path
- **Target:** Native `GEOMETRY` columns with spatial indexes

**Benefits:**
- Spatial queries: "Find all projects within 5km of location X"
- Real-time web editing (no file upload/download)
- Vector tile serving for web maps
- Export to Shapefile/KML on-demand

---

### 4. Offline-First Mobile

**Rationale:** Field engineers work in areas with poor connectivity. Offline capability is mandatory.

**Strategy:**
- Local SQLite database mirrors server schema
- Capture data (GPS, photos, progress) offline
- Background sync via WorkManager when online
- Conflict resolution: Server state wins
- Hash calculation on device ensures data integrity

---

### 5. Role-Based Access Control (RBAC)

**Roles:**
- **Public:** Read-only access to published projects
- **DEO User:** CRUD for own DEO's projects
- **Regional Admin:** CRUD for region, manage DEO users
- **Super Admin:** Full system access, audit logs

**Enforcement:**
- API layer: Dependency injection checks JWT claims
- Database layer: PostgreSQL Row-Level Security (RLS) policies
- Frontend layer: Conditional rendering based on role

---

## SECURITY HIGHLIGHTS

### Authentication
- JWT tokens with 1-hour expiration
- bcrypt password hashing (cost factor 12)
- Token blacklist (Redis) for logout
- Session management via secure cookies

### Authorization
- Four-tier RBAC (public, deo_user, regional_admin, super_admin)
- Row-level security policies in PostgreSQL
- API endpoints filtered by role and DEO affiliation

### Data Integrity
- Immutable progress logs with hash chaining
- Database triggers prevent tampering
- Daily automated verification
- Full audit trail (who, what, when)

### Encryption
- TLS 1.3 for all API communication
- PostgreSQL SSL connections
- Filesystem encryption for backups
- S3 bucket encryption at rest

### Input Validation
- Pydantic models with type validation
- SQL injection prevention (parameterized queries)
- XSS prevention (React auto-escaping)
- File upload validation (type, size, malware scan)

---

## MIGRATION STRATEGY SUMMARY

### Phase 1: Infrastructure (Week 1)
- Deploy PostgreSQL + PostGIS
- Configure object storage (MinIO)
- Network setup

### Phase 2: Schema & Bootstrap (Week 1-2)
- Create target schema
- Bootstrap users
- Create indexes and triggers

### Phase 3: Data Migration (Week 2-3)
- DEO table (direct copy)
- Projects (INT → UUID mapping)
- Progress logs (hash chain reconstruction)
- Media files (filesystem → S3)
- GIS features (Shapefile → PostGIS)

### Phase 4: Validation (Week 4)
- Record count verification
- Hash chain validation
- User acceptance testing
- Performance testing

### Phase 5: Cutover (Week 5)
- Final sync
- Switch DNS
- Monitor for 48 hours
- Decommission legacy

**Rollback:** Revert DNS to legacy system if critical issues detected

---

## COMPLIANCE WITH INCEPTION REPORT

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| **A. Integrated GIS Mapping** | ✅ Complete | PostGIS native storage, vector tiles, spatial indexes |
| **B. Web-based GIS Editing** | ✅ Complete | MapLibre + Mapbox Draw, geofencing validation |
| **C. GIS-Aided Progress Monitoring** | ✅ Complete | Progress logs linked to GIS features, spatial queries |
| **D. Tamper-Proof Progress Reporting** | ✅ Complete | Hash chaining, immutable logs, database triggers |
| **E. Mobile Application Support** | ✅ Complete | Android offline-first app with GPS, camera, sync |
| **F. Web Application Enhancements** | ✅ Complete | React SPA, role-based dashboards, modern UX |
| **G. Server Migration & Optimization** | ✅ Complete | PostgreSQL + PostGIS, object storage, caching |

---

## NEXT STEPS FOR IMPLEMENTATION TEAM

### 1. Backend Development
- [x] Set up FastAPI project structure
- [x] Implement authentication & RBAC
- [x] Create SQLAlchemy models
- [x] Build API endpoints (refer to [API_DESIGN.md](API_DESIGN.md))
- [x] Implement User Management API
- [x] Implement Groups & Access Rights API
- [x] Implement MFA (Multi-Factor Authentication)
- [x] Implement Audit Logging
- [ ] Write unit tests (pytest)
- [ ] Deploy to staging environment

### 2. Frontend Development
- [x] Set up React + Vite project
- [x] Implement routing and layouts
- [x] Build admin dashboard
- [x] Create GIS editor (Leaflet + react-leaflet-draw)
- [x] Implement progress timeline
- [x] Build User Management settings page
- [x] Build Groups Management settings page
- [x] Build Access Rights settings page
- [x] Build Audit Logs viewer
- [x] Implement MFA setup wizard
- [x] Implement Profile page
- [ ] Deploy to staging

### 3. Mobile Development
- [ ] Set up Android project (Kotlin + Compose)
- [ ] Implement Room database
- [ ] Build camera + GPS capture
- [ ] Create sync workers
- [ ] Test offline functionality
- [ ] Release beta to Play Store

### 4. Database Migration
- [ ] Run migration scripts (refer to [MIGRATION.md](MIGRATION.md))
- [ ] Validate data integrity
- [ ] Verify hash chains
- [ ] Test performance

### 5. Security Audit
- [ ] Penetration testing
- [ ] Code review (security focus)
- [ ] Compliance check (refer to [SECURITY.md](SECURITY.md))
- [ ] Fix vulnerabilities

### 6. User Training
- [ ] Admin user training (project management)
- [ ] DEO user training (field data entry)
- [ ] Mobile app training (offline usage)
- [ ] Documentation (user manuals)

### 7. Go-Live
- [ ] Final cutover (refer to [MIGRATION.md](MIGRATION.md))
- [ ] Monitor for 48 hours
- [ ] User support (hotline)
- [ ] Post-launch review

---

## PROJECT TEAM CONTACTS

**Client:** MPW-BARMM
**System Architect:** [Your Name]
**Date:** January 2026

---

## DOCUMENT VERSION

**Version:** 1.1
**Last Updated:** 2026-01-04
**Status:** Implementation In Progress - Backend & Frontend Core Features Complete

---

## LICENSE & CONFIDENTIALITY

This document is proprietary and confidential. Distribution is restricted to authorized MPW-BARMM personnel and contracted implementation teams.

---

**END OF DOCUMENTATION**

All technical specifications, API contracts, database schemas, and security controls are detailed in the linked design documents. Implementation teams should reference these documents during development and maintain alignment with the architectural decisions outlined herein.
