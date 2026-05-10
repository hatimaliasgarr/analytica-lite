# 🛒 Olist E-Commerce Analytics Dashboard

> **Enterprise-Grade, Cloud-Native Analytics Platform**  
> Migrated from static CSV pipelines to a fully managed BaaS architecture — powered by **Supabase**, deployed on **Vercel**, and extended with **Tableau BI**.

[![Status](https://img.shields.io/badge/Status-Production--Ready-brightgreen?style=flat-square)](https://vercel.com)
[![DB](https://img.shields.io/badge/Database-PostgreSQL%2015%20%7C%20Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)
[![ETL](https://img.shields.io/badge/ETL-Python%20%7C%20Pandas-3776AB?style=flat-square&logo=python)](https://pandas.pydata.org)

---

## 📋 Table of Contents

- [Project Overview](#1-project-overview)
- [Architecture Diagram](#2-architecture-diagram)
- [Technology Stack](#3-technology-stack)
- [Repository Structure](#4-repository-structure)
- [Getting Started](#5-getting-started)
- [ETL Pipeline](#6-etl-pipeline)
- [Database Schema](#7-database-schema)
- [Frontend Dashboard](#8-frontend-dashboard)
- [Tableau Integration](#9-tableau-integration)
- [Deployment Guide](#10-deployment-guide)
- [Post-Mortem: Issues & Resolutions](#11-post-mortem-issues--resolutions)
- [Roadmap v2.0](#12-roadmap-v20)
- [Contributing](#13-contributing)

---

## 1. Project Overview

### 1.1 Vision

This project delivers a **Single Source of Truth** for Olist e-commerce stakeholders. Raw, fragmented CSV data is ingested, cleaned, and centralized into a cloud PostgreSQL instance — eliminating local data silos and enabling consistent reporting across all tools.

### 1.2 Core Capabilities

| Capability | Description |
|---|---|
| 🔄 **Automated ETL** | Python/Pandas pipeline for ingestion, cleaning, and loading |
| ☁️ **Cloud Database** | Supabase-hosted PostgreSQL with materialized views for speed |
| 📊 **Live Dashboard** | Vanilla JS + Chart.js frontend with real-time Supabase sync |
| 📈 **BI Reports** | Tableau Desktop integration for deep-dive exploratory analysis |
| 🚀 **Edge Delivery** | Static frontend deployed globally via Vercel CDN |

### 1.3 Design Goals

- **Performance**: All heavy aggregations are computed server-side via SQL Materialized Views — the browser only renders pre-processed data.
- **Consistency**: One database instance serves both the web dashboard and Tableau, eliminating metric discrepancies.
- **Lean Stack**: Zero backend servers, zero framework overhead. Pure HTML/CSS/JS on the frontend.
- **Maintainability**: Any developer familiar with Python, SQL, and basic JS can operate, debug, and extend this project.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                              │
│   📁 Olist CSVs  ·  📊 Excel/Sheets (v2.0)  ·  🛍️ Shopify (v2.0) │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ETL PIPELINE (Python)                       │
│         scripts/etl_pipeline.py  ·  Pandas  ·  psycopg2         │
│   [Extract] → [Clean & Deduplicate] → [Schema Map] → [Load]     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               SUPABASE (PostgreSQL 15 Cloud)                     │
│  ┌────────────────────┐    ┌──────────────────────────────────┐ │
│  │   Raw Tables       │    │     Materialized Views           │ │
│  │  - orders          │───▶│  - mv_revenue_by_month           │ │
│  │  - order_items     │    │  - mv_top_categories             │ │
│  │  - customers       │    │  - mv_seller_performance         │ │
│  │  - products        │    │  - mv_customer_geography         │ │
│  │  - reviews         │    └──────────────┬───────────────────┘ │
│  └────────────────────┘                   │                     │
│                          PostgREST API ◀──┘                     │
└──────────────┬────────────────────────────┬─────────────────────┘
               │                            │
               ▼                            ▼
┌──────────────────────┐      ┌─────────────────────────────────┐
│  VERCEL (Frontend)   │      │   TABLEAU DESKTOP               │
│  index.html          │      │   olist_datasource.twb          │
│  Supabase JS SDK     │      │   Direct PostgreSQL connection  │
│  Chart.js            │      │   Exploratory dashboards        │
└──────────────────────┘      └─────────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1 Backend & Data Engineering

| Tool | Version | Purpose |
|---|---|---|
| **Python** | 3.10+ | ETL orchestration and data cleaning |
| **Pandas** | 2.x | DataFrame transformations, deduplication, schema mapping |
| **psycopg2 / SQLAlchemy** | Latest | PostgreSQL connection and bulk loading |
| **PostgreSQL** | 15 | Primary analytical data store |
| **Supabase** | Cloud | Managed PostgreSQL hosting + PostgREST API + real-time sync |

### 3.2 Frontend & Visualization

| Tool | Purpose |
|---|---|
| **HTML5 / Vanilla CSS** | Custom design system — Glassmorphism, CSS Grid, Flexbox, micro-animations |
| **Vanilla JavaScript (ES6+)** | Async data fetching via Supabase JS SDK |
| **Chart.js** | Bar, line, doughnut, and radar chart rendering |

### 3.3 Business Intelligence

| Tool | Purpose |
|---|---|
| **Tableau Desktop** | Deep-dive exploratory analysis beyond standard dashboard KPIs |

### 3.4 Infrastructure & DevOps

| Tool | Purpose |
|---|---|
| **Vercel** | Static hosting with global CDN edge delivery |
| **GitHub** | Version control and CI/CD trigger for Vercel deployments |
| **.env** | Environment variable management for secrets isolation |

---

## 4. Repository Structure

```
olist-dashboard/
│
├── 📁 scripts/                    # Backend — isolated from Vercel detection
│   ├── etl_pipeline.py            # Main ETL script: extract → transform → load
│   ├── db_setup.py                # One-time schema creation & materialized views
│   ├── requirements.txt           # Python dependencies (NOT in root)
│   └── utils/
│       ├── cleaners.py            # Reusable Pandas cleaning functions
│       └── supabase_loader.py     # Bulk upsert helper
│
├── 📁 data/                       # Raw source CSVs (gitignored in production)
│   ├── olist_orders_dataset.csv
│   ├── olist_order_items_dataset.csv
│   ├── olist_customers_dataset.csv
│   ├── olist_products_dataset.csv
│   └── olist_order_reviews_dataset.csv
│
├── 📁 tableau/
│   └── olist_datasource.twb       # Minimal bootstrap TWB (Data Source only)
│
├── 📁 public/                     # Static frontend served by Vercel
│   ├── index.html                 # Main dashboard
│   ├── styles.css                 # Design system
│   ├── supabase-client.js         # Supabase JS SDK init
│   └── charts.js                  # Chart.js rendering logic
│
├── .env.example                   # Environment variable template
├── .vercelignore                  # Prevents Vercel from indexing scripts/
├── vercel.json                    # Static builder config (bypasses framework detection)
├── package.json                   # Dummy package — forces Vercel to treat as static
└── README.md
```

---

## 5. Getting Started

### 5.1 Prerequisites

- Python 3.10+
- Node.js (optional, only needed if extending with npm tooling)
- A [Supabase](https://supabase.com) project (free tier is sufficient)
- Tableau Desktop (optional, for BI layer)

### 5.2 Environment Setup

Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
```

```ini
# .env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here   # ETL only — never expose to frontend
DB_HOST=db.your-project-id.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-db-password
```

> ⚠️ **Security Note**: `SUPABASE_SERVICE_ROLE_KEY` and `DB_PASSWORD` must **never** be committed or exposed in frontend code. Use `SUPABASE_ANON_KEY` in the browser.

### 5.3 Install Python Dependencies

```bash
pip install -r scripts/requirements.txt
```

---

## 6. ETL Pipeline

### 6.1 Overview

The pipeline follows a classic **ELT pattern** — raw data is loaded first, then transformed inside the database using SQL views for maximum performance.

```
[CSV Files] → Extract → Clean (Pandas) → Load Raw Tables → Refresh Materialized Views
```

### 6.2 Running the Pipeline

```bash
# Step 1: Initialize database schema (run once)
python scripts/db_setup.py

# Step 2: Run the full ETL pipeline
python scripts/etl_pipeline.py
```

### 6.3 Key Transformations

| Stage | Operation |
|---|---|
| **Extract** | Read CSVs with `pd.read_csv()`, enforce dtypes |
| **Clean** | Drop duplicates, handle nulls, normalize text fields, parse dates |
| **Validate** | Assert referential integrity (e.g., every `order_item` has a valid `order_id`) |
| **Load** | Bulk upsert into Supabase using `ON CONFLICT DO NOTHING` |
| **Refresh** | `REFRESH MATERIALIZED VIEW CONCURRENTLY` for all analytical views |

### 6.4 Scheduling (Optional)

To automate periodic refreshes, add a cron job:

```bash
# Refresh every day at 2:00 AM
0 2 * * * /usr/bin/python3 /path/to/scripts/etl_pipeline.py >> /var/log/etl.log 2>&1
```

Or use **GitHub Actions** to trigger on a schedule and keep the cloud DB fresh.

---

## 7. Database Schema

### 7.1 Core Tables

```sql
-- Orders: the central fact table
CREATE TABLE orders (
  order_id             TEXT PRIMARY KEY,
  customer_id          TEXT NOT NULL,
  order_status         TEXT,
  order_purchase_ts    TIMESTAMPTZ,
  order_delivered_ts   TIMESTAMPTZ,
  order_estimated_ts   TIMESTAMPTZ
);

-- Order Items: line-level detail
CREATE TABLE order_items (
  order_id        TEXT REFERENCES orders(order_id),
  order_item_id   INTEGER,
  product_id      TEXT,
  seller_id       TEXT,
  price           NUMERIC(10,2),
  freight_value   NUMERIC(10,2),
  PRIMARY KEY (order_id, order_item_id)
);
```

### 7.2 Materialized Views (Analytical Layer)

```sql
-- Monthly revenue trend
CREATE MATERIALIZED VIEW mv_revenue_by_month AS
SELECT
  DATE_TRUNC('month', o.order_purchase_ts) AS month,
  SUM(oi.price)                            AS total_revenue,
  COUNT(DISTINCT o.order_id)               AS total_orders
FROM orders o
JOIN order_items oi USING (order_id)
WHERE o.order_status = 'delivered'
GROUP BY 1
ORDER BY 1;

-- Refresh command (run after each ETL load)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_by_month;
```

> All materialized views are defined in `scripts/db_setup.py` and are refreshed automatically at the end of each ETL run.

---

## 8. Frontend Dashboard

### 8.1 Design System

The dashboard uses a custom CSS design system with:

- **Glassmorphism**: Frosted-glass card components using `backdrop-filter: blur()`
- **CSS Grid + Flexbox**: Fully responsive layouts from mobile to 4K
- **Micro-animations**: Entrance transitions, hover states, and loading skeletons
- **CSS Custom Properties**: All colors, spacing, and shadows centralized as variables

### 8.2 Data Fetching

The frontend uses the **Supabase JS SDK** to query materialized views directly:

```javascript
// supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const supabase = createClient(
  'https://your-project-id.supabase.co',  // ← SUPABASE_URL
  'your-anon-key'                          // ← SUPABASE_ANON_KEY (safe for browser)
);

// charts.js — example fetch
const { data, error } = await supabase
  .from('mv_revenue_by_month')
  .select('month, total_revenue, total_orders')
  .order('month', { ascending: true });
```

### 8.3 Running Locally

```bash
# Serve the public/ directory (avoids CORS issues with Supabase)
python -m http.server 8000 --directory public
# Open: http://localhost:8000
```

---

## 9. Tableau Integration

### 9.1 Strategy: Connection Bootstrap

Rather than generating full Tableau workbook XML (which is fragile), we provide a **minimal `.twb` file** that only defines the Data Source connection. Users open it in Tableau Desktop and build visuals natively — avoiding XML schema errors entirely.

### 9.2 Connecting Tableau to Supabase

1. Open `tableau/olist_datasource.twb` in Tableau Desktop.
2. When prompted, enter your Supabase PostgreSQL credentials:

| Field | Value |
|---|---|
| Server | `db.your-project-id.supabase.co` |
| Port | `5432` |
| Database | `postgres` |
| Username | `postgres` |
| Password | *(from .env)* |
| SSL | Required |

3. Tableau will connect to live PostgreSQL — including all materialized views as data sources.

---

## 10. Deployment Guide

### 10.1 Vercel Configuration

The key insight: Vercel auto-detects `requirements.txt` and assumes a Python API project. We override this with explicit config files.

**`vercel.json`**:
```json
{
  "version": 2,
  "builds": [{ "src": "public/**", "use": "@vercel/static" }],
  "routes": [{ "src": "/(.*)", "dest": "public/$1" }]
}
```

**`.vercelignore`**:
```
scripts/
data/
*.csv
.env
```

### 10.2 Deploying

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (follow prompts)
vercel --prod
```

Or connect your GitHub repository to Vercel for automatic deployments on every push to `main`.

### 10.3 Environment Variables in Vercel

In the Vercel dashboard → **Settings → Environment Variables**, add:

```
SUPABASE_URL         = https://your-project-id.supabase.co
SUPABASE_ANON_KEY    = your-anon-key
```

> Do **not** add `SUPABASE_SERVICE_ROLE_KEY` or `DB_PASSWORD` to Vercel — these are ETL-only secrets.

---

## 11. Post-Mortem: Issues & Resolutions

### 11.1 Tableau XML Schema Corruption

| | |
|---|---|
| **Symptom** | `Fatal Error(4,38)` / `Error Code: D2E8DA72` on workbook open |
| **Root Cause** | Manually injected XML violated Tableau's strict zone/pane/edge layout schema |
| **Resolution** | Adopted the "Connection Bootstrap" pattern — generate only the `<datasource>` XML block, not the full workbook layout. Users build dashboards in native Tableau from a clean connection. |

### 11.2 Vercel Build Failure — Python Runtime Conflict

| | |
|---|---|
| **Symptom** | `Error: No python entrypoint found` during Vercel build |
| **Root Cause** | Vercel's framework auto-detector found `requirements.txt` in the project root and assumed the project was a Python serverless app |
| **Resolution** | ① Moved all Python files to `scripts/` subdirectory. ② Added `.vercelignore` to exclude backend files. ③ Created a minimal `package.json` and explicit `vercel.json` with a static builder to force correct framework detection. |

### 11.3 Live Dashboard Showing Zero Values

| | |
|---|---|
| **Symptom** | All KPIs and charts displayed `0` or empty on the deployed site |
| **Root Cause** | A character typo in the Supabase Project ID URL — `pxrmm` instead of `pxrjm` — caused all API calls to fail silently |
| **Resolution** | Standardized the Supabase URL across `.env`, `supabase-client.js`, and Vercel environment variables. Added an explicit connection validation step to the app initialization flow. |

---

## 12. Roadmap v2.0

### 12.1 Universal Data Adapter

The current architecture is a foundation for a multi-provider analytics engine.

- [ ] **Excel / Google Sheets**: Real-time import via the Sheets API for ad-hoc analysis
- [ ] **Provider Adapters**: One-click connectors for Shopify, WooCommerce, and Magento
- [ ] **Local-First Mode**: Toggle between Supabase (Cloud) and SQLite (Offline) without touching UI code

### 12.2 Advanced Analytics & Data Science

- [ ] **CLV Prediction**: Predict Customer Lifetime Value using historical purchase frequency (RFM model)
- [ ] **Inventory Optimization**: Reorder Point alerts when stock levels drop below threshold
- [ ] **Automated Anomaly Detection**: SQL-based detection of sudden revenue drops or order cancellation spikes
- [ ] **Cohort Analysis**: Retention curves and purchase behavior by customer acquisition cohort

### 12.3 Infrastructure & DevOps

- [ ] **GitHub Actions ETL**: Automated pipeline runs on schedule via CI/CD
- [ ] **dbt Integration**: Replace raw SQL scripts with dbt models for lineage, testing, and documentation
- [ ] **Alerting**: Supabase Edge Functions to send Slack/email alerts on anomaly detection triggers

---

## 13. Contributing

### 13.1 Workflow

```bash
# Clone the repo
git clone https://github.com/your-org/olist-dashboard.git
cd olist-dashboard

# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes, then commit
git add .
git commit -m "feat: describe your change"

# Push and open a Pull Request
git push origin feature/your-feature-name
```

### 13.2 Code Standards

- **Python**: Follow PEP 8. All ETL functions must have docstrings.
- **SQL**: All views and tables must include inline comments explaining business logic.
- **JavaScript**: Use `const`/`let`, async/await. No jQuery.
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).

---

## Project Metadata

| Key | Value |
|---|---|
| **Status** | ✅ Production-Ready — Deployed on Vercel |
| **Database** | PostgreSQL 15 (Supabase Cloud) |
| **Core Maintainer** | Antigravity AI |
| **Documentation Last Updated** | 2025 |

---

*This documentation serves as the canonical technical reference for all architecture decisions, troubleshooting history, and future development direction. Keep it updated as the project evolves.*
