# Workspace Organization Report

Generated: 2026-03-07
Scope: `C:\Users\conor\Desktop\MasterRecovery3`

## Current Snapshot

- Total files: `42,528`
- Total directories: `6,247`
- Total size: `183.06 GiB`
- Root files: `20`
- Root directories: `46`
- Probable duplicate name groups: `5,656`
- Automated root cleanup status: complete
- Verified exact-duplicate hardlink dedupe status: complete

Inventory outputs:

- `data/inventory/workspace/workspace_summary.json`
- `data/inventory/workspace/workspace_manifest.csv`
- `data/inventory/workspace/workspace_top_level_dirs.csv`
- `data/inventory/workspace/workspace_largest_files.csv`
- `data/inventory/workspace/workspace_root_files.csv`
- `data/inventory/workspace/workspace_probable_duplicates.csv`
- `data/inventory/workspace/heavy_duplicate_hashes_20260307.json`
- `data/inventory/workspace/next_heavy_duplicate_hashes_20260307_081147.json`
- `data/inventory/workspace/verified_duplicate_hashes_pass2_20260307_081147.json`
- `data/inventory/workspace/next_heavy_duplicate_hashes_20260307_083448.json`
- `data/inventory/workspace/verified_duplicate_hashes_pass3_adjusted_20260307_01.json`
- `data/inventory/workspace/next_heavy_duplicate_hashes_20260307_112150.json`
- `data/inventory/workspace/git_drive_orphan_collision_analysis_20260307_01.json`
- `data/inventory/workspace/git_drive_orphan_loose_object_headers_20260307_01.json`
- `data/inventory/workspace/disk_image_external_hardlink_analysis_20260307_01.json`
- `data/inventory/workspace/disk_image_external_hardlink_mapping_20260307_01.json`
- `logs/dedupe/verified_duplicate_dedupe_20260307_032551.csv`
- `logs/dedupe/verified_duplicate_dedupe_20260307_032551.txt`
- `logs/dedupe/verified_duplicate_dedupe_20260307_081900.csv`
- `logs/dedupe/verified_duplicate_dedupe_20260307_081900.txt`
- `logs/dedupe/verified_duplicate_dedupe_20260307_111836.csv`
- `logs/dedupe/verified_duplicate_dedupe_20260307_111836.txt`

Regenerate with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/core/inventory_workspace.ps1
```

## What Changed Since The First Pass

- Root clutter was reduced from `973` files to `20` files.
- Total workspace size dropped from `292.86 GiB` to `183.06 GiB`.
- `scripts/core/organize_root_loose_files.ps1 -Mode DryRun` now returns `No matching root files found for cleanup.`
- `Archive.zip` and `ScannedBP.zip` were restored into `archive/root_archives` from surviving local duplicates.
- `MasterRecovery3.backup.20260302-194852` is still not present in the workspace.
- `scripts/core/dedupe_verified_duplicates.ps1` replaced `3` verified duplicate paths with hardlinks in pass 1.
- `scripts/core/hash_next_duplicate_candidates.ps1` found `2` additional exact duplicate text sets in pass 2.
- `scripts/core/dedupe_verified_duplicates.ps1` replaced `4` additional verified duplicate paths with hardlinks in pass 2.
- `scripts/core/hash_next_duplicate_candidates.ps1` found `3` more exact duplicate sets in a later archive-focused pass.
- `scripts/core/dedupe_verified_duplicates.ps1` replaced `3` additional archive-path duplicates in pass 3, while `2` archive EFU copies were already on the same file record.
- `Imported_Data\Drive_Orphans` is no longer live under `Imported_Data`; the current surviving subtree is under `archive\Imported_Data\Drive_Orphans`.
- The current inventory manifests are stale for `Drive_Orphans` and other moved archive paths.
- Live `C:` free space later in the session was `173.02 GiB`, but that value is now volatile because active sync/upload tools are maintaining hardlinked temp-cache entries.

## Largest Top-Level Areas

| Area | Files | Size (GiB) |
| --- | ---: | ---: |
| `Imported_Data` | 3,030 | 80.98 |
| `archive` | 1,472 | 31.81 |
| `forensic_data` | 1,247 | 30.03 |
| `.git` | 6,155 | 18.35 |
| `extracted_recovery` | 2,574 | 11.35 |
| `data` | 67 | 5.91 |
| `Files` | 17 | 2.33 |
| `btcrecover_env` | 23,025 | 0.60 |
| `config` | 27 | 0.60 |
| `incoming` | 62 | 0.27 |

## Heaviest Repeated Artifacts

Hash verification results are stored in `data/inventory/workspace/heavy_duplicate_hashes_20260307.json`.

Verified exact duplicates:

1. Three `27.17 GiB` disk images share SHA-256 `0626C08F...CFBBCFDA6`:
   - `Imported_Data\GDrive_Crypto_Recovery_Backups\Unallocated.dsk`
   - `Imported_Data\GDrive_Crypto_Recovery_Backups\Volume 1 (Linux Linux filesystem data).dsk`
   - `archive\root_disk_images\Volume 1 (Linux Linux filesystem data).dsk`
2. Two `1.25 GiB` copies of `shdw_cpes_deleted_files.txt` share SHA-256 `90EEF21E...5E780CB5`:
   - `Files\shdw_cpes_deleted_files.txt`
   - `extracted_recovery\RECOVERY\RECOVERY\Files\shdw_cpes_deleted_files.txt`

Same size but not exact duplicates:

1. `forensic_data\gdrive_import_20260306_160512\Volume 1 (Linux Linux filesystem data).dsk` is `27.17 GiB` but has a different SHA-256.
2. The other two `shdw_cpes_deleted_files.txt` copies are not byte-identical.
3. All four `deleted_files_HP15_AllShadowCopies.txt` files are different despite matching size.

Executed reclaim:

- `Imported_Data\GDrive_Crypto_Recovery_Backups\Unallocated.dsk` now hardlinks to `archive\root_disk_images\Volume 1 (Linux Linux filesystem data).dsk`
- `Imported_Data\GDrive_Crypto_Recovery_Backups\Volume 1 (Linux Linux filesystem data).dsk` now hardlinks to `archive\root_disk_images\Volume 1 (Linux Linux filesystem data).dsk`
- `extracted_recovery\RECOVERY\RECOVERY\Files\shdw_cpes_deleted_files.txt` now hardlinks to `Files\shdw_cpes_deleted_files.txt`
- `Imported_Data\Global_Text_Docs\OneDrive\Desktop\RECOVERY\Files\deleted_files.txt` now hardlinks to `Files\deleted_files.txt`
- `extracted_recovery\RECOVERY\RECOVERY\Files\deleted_files.txt` now hardlinks to `Files\deleted_files.txt`
- `Imported_Data\Global_Text_Docs\OneDrive\Desktop\RECOVERY\Files\all_deleted_files.txt` now hardlinks to `Files\all_deleted_files.txt`
- `extracted_recovery\RECOVERY\RECOVERY\Files\all_deleted_files.txt` now hardlinks to `Files\all_deleted_files.txt`
- `archive\extracted_recovery\Crypto_Recovery_Backups-20260228T205929Z-1-004\Crypto_Recovery_Backups\recovery (1)\Android\bettercutslawncare@gmail.com\Pixel 9 Pro Fold_b33b82f8-6334-407c-933f-c9ce6347d61d\Apps\Procare(com.kinderlime.dev).apk` now hardlinks to `archive\forensic_data\gdrive_import_20260306_160512\Recovery\IDrive_download\bettercutslawncare@gmail.com\Pixel 9 Pro Fold_b33b82f8-6334-407c-933f-c9ce6347d61d\Apps\Procare(com.kinderlime.dev).apk`
- `archive\extracted_recovery\Crypto_Recovery_Backups-20260228T205929Z-1-004\Crypto_Recovery_Backups\recovery (1)\Android\bettercutslawncare@gmail.com\Pixel 9 Pro Fold_b33b82f8-6334-407c-933f-c9ce6347d61d\Apps\Amazon Photos(com.amazon.clouddrive.photos).apk` now hardlinks to `archive\personal\recovery_gdrive_export\Recovery\IDrive_download\bettercutslawncare@gmail.com\Pixel 9 Pro Fold_b33b82f8-6334-407c-933f-c9ce6347d61d\Apps\Amazon Photos(com.amazon.clouddrive.photos).apk`
- `archive\forensic_data\gdrive_import_20260306_160512\Recovery\IDrive_download\bettercutslawncare@gmail.com\Pixel 9 Pro Fold_b33b82f8-6334-407c-933f-c9ce6347d61d\Apps\Amazon Photos(com.amazon.clouddrive.photos).apk` now hardlinks to `archive\personal\recovery_gdrive_export\Recovery\IDrive_download\bettercutslawncare@gmail.com\Pixel 9 Pro Fold_b33b82f8-6334-407c-933f-c9ce6347d61d\Apps\Amazon Photos(com.amazon.clouddrive.photos).apk`

Additional pass-2 findings:

1. Three `456,371,240` byte copies of `deleted_files.txt` share SHA-256 `60A0B269...42A9B8C0`.
2. Three `456,331,034` byte copies of `all_deleted_files.txt` share SHA-256 `322E9B00...D9EE5751`.

Additional pass-3 findings:

1. Three archive copies of `everything(thispc-d-e-i-n).efu` were already hardlinked before the pass-3 execute run.
2. Two archive copies of `Procare(com.kinderlime.dev).apk` were deduped.
3. Three archive copies of `Amazon Photos(com.amazon.clouddrive.photos).apk` were deduped.
4. A follow-up heavy hash wave returned `0` remaining candidate groups at `>= 100 MiB` after the processed reports were excluded.

Total verified duplicate space reclaimed by the executed hardlink dedupe across the completed passes: approximately `57.66 GiB`.

## Drift Investigation

The apparent disappearance of `Imported_Data\Drive_Orphans\Desktop\135701` and `134871` was a move, not a delete:

1. The live `Imported_Data\Drive_Orphans` subtree is gone.
2. The current files now live under `archive\Imported_Data\Drive_Orphans\Desktop\135701` and `archive\Imported_Data\Drive_Orphans\Desktop\134871`.
3. Those archived files have the same file IDs recorded earlier for the live `Imported_Data\...` paths, which means the files were moved on the same volume rather than recopied.

The `.git` collision conclusion:

1. `.git\objects\cd\bfe78...` and `archive\Imported_Data\Drive_Orphans\Desktop\135701` both expose the loose-object header `blob 2935295447`.
2. `.git\objects\fd\259ca...` and `archive\Imported_Data\Drive_Orphans\Desktop\134871` both expose the loose-object header `blob 887946566`.
3. They are not hardlinks and they were not exact byte duplicates in the earlier SHA-256 check, so they are best treated as related loose Git object files, not safe file-level dedupe candidates.

## Upload Cache Risk

`C:\Users\conor\Desktop\.tmp.driveupload` is a large hardlink-backed temp cache:

1. The parent directory currently contains `19,571` items.
2. Top entries hardlink back into the workspace, including:
   - the `27.17 GiB` disk-image record,
   - `tails_data.dd`,
   - the imported USB `Recovery*.vhdx` files,
   - `deleted_files_HP15_AllShadowCopies.txt`,
   - `config\tier3_pattern_list.txt`
3. Active sync-related processes were present during inspection: `GoogleDriveFS`, `OneDrive`, and `FileSyncHelper`.

Because of that, deleting a workspace file may not free space until the `.tmp.driveupload` hardlink is also gone, and deleting `.tmp.driveupload` directly while those sync clients are active is not a safe cleanup step.

## Missing Item Investigation

Recovered:

- `Archive.zip`
- `ScannedBP.zip`

Still unresolved after rerun:

- `RECOVERY.zip`
- `openrouter-cli-main.zip`
- `Crypto_Recovery_Backups-20260228T205929Z-1-004.zip`
- `MasterRecovery3.backup.20260302-194852`

The unresolved names were not found in:

- The current workspace
- The saved `G:` manifest at `data/consolidation/g_drive_manifest.csv`
- A direct targeted recycle-bin name check

## Operational Risk

The fragmentation report at `C:\Users\conor\Downloads\fragmented_files.txt` showed `Windows (C:)` effectively full:

- Capacity: `953 GB`
- Used: `953 GB (100%)`
- Free: `343 MB (0%)`

Live free-space checks moved from `280.02 GiB` earlier in the session to `173.02 GiB` later. The main reason is not the dedupe work itself; it is the active sync/upload cache creating and holding large hardlinked temp copies under `.tmp.driveupload`.

## Recommended Next Moves

1. Rerun `scripts/core/inventory_workspace.ps1` before any more dedupe work so the manifests stop pointing at stale pre-archive paths.
2. If you want real storage reclamation, pause or quiet the active sync/upload tools before touching `.tmp.driveupload`-linked workspace files.
3. Decide whether the `18.35 GiB` `.git` history needs to remain in this recovery workspace.
4. Keep the workspace root as code/config only; no additional root cleanup is currently needed.
