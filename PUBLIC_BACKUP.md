# Public source and model backup

This repository is a reviewed public export of Eureka. It is **not a complete backup of private datasets, database state, credentials, or the original Git history**. The original local workspace is unchanged.

## Included

- Frontend, backend/API, migrations, training/research source, tests and suitable fixtures.
- All 221 locked Weather AI V3 LightGBM models, their schema/manifest, aggregate disease catalog and medical knowledge base.
- Forecast model, research/comparison model files, Weather AI V2 models and benchmark model checkpoints that passed the local model audit.
- Notebook cell sources, with all saved outputs, execution counts and machine-specific cell metadata removed in this export only.
- Eligible historical documentation/source snapshots. Some links in historical reports refer to deliberately unpublished captures; those reports have not been rewritten to claim that missing evidence was rerun.

`PUBLIC_MODEL_MANIFEST.json` records the exact model paths, sizes and SHA-256 hashes. Models are stored through Git LFS.

## Required private resources — provide separately

- `seasonal_disease_backend/app/ml/seasonal_forecast_data/train_history.xlsx` and all identical copies are excluded by SHA-256, regardless of their filename. The original workbook contains patient records and must remain in a separately controlled backup.
- Other patient Excel files, raw/processed training datasets, row-level evaluation arrays and unapproved CSV/Excel files are excluded. The retained aggregate disease catalog and medical literature matrix contain no individual patient records.
- SQLite databases, uploads, `.env`, credentials/keys, unreviewed ZIP files, logs, screenshots and PDF captures are not part of this public backup.
- `node_modules`, virtual environments, caches and vendored `runtime_deps` are local dependencies, not published environments. Install runtime/research dependencies in your own environment; the backend's V3 SHAP contributions use the LightGBM runtime rather than these saved research environments.

**Forecast cannot run until its authorized matching workbook is restored locally.** Training, evaluation and historical research also need the separately supplied authorized datasets/weather inputs. Existing database accounts, imported clinical data, stored report history, visibility settings and permissions are not restored by cloning source. Backend startup against a prepared isolated DB and secure configuration is a separate operational step. The public clone alone does not reproduce the private live system.

No synthetic workbook was substituted, no model was retrained, and no patient dataset was changed locally. Do not upload the private files to complete this public repository.

## Clone and continue development

Install Git LFS, then:

```powershell
git clone https://github.com/dauxanhduamuoi/eureka-pediatric-health-analytics.git
cd eureka-pediatric-health-analytics
git lfs pull
```

Use the independent `eureka-pediatric-health-analytics` checkout for future public commits. Keep private datasets outside Git and keep the original workspace as the private source/reference backup. Review `git status` and the staged diff before each commit; a filename change does not make patient data safe to publish.

```powershell
git status
git add <reviewed-source-paths>
git diff --cached --stat
git commit -m "Describe the source change"
git push
```

Git LFS is required to restore model bytes; a pointer file is not the model. See [GitHub LFS limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage) and [billing/quota documentation](https://docs.github.com/en/billing/concepts/product-billing/git-lfs). Public visibility does not authorize publication of private clinical data. No new license or claim of ownership over third-party material is introduced; original attribution/license notices are retained.
