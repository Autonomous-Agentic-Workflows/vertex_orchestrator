# Workspace Root Map

This workspace already looks consolidated. The useful job now is labeling the big buckets and keeping the root understandable.

Generated: 2026-03-10T18:49:46.008Z
Source snapshot: `C:\Users\conor\Desktop\MasterRecovery3\Scan\filesystem_inventory_summary.json`

## Reading Guide

- `consolidated-source`: imported material, archives, scans, recovery evidence, or phone exports
- `tooling`: repos, environments, configs, or automation support
- `temp/cache`: validate before deleting; likely reclaimable
- `loose-root-file`: one-off root item that should eventually be filed

## Major Root Buckets

| Entry | Class | Size |
| --- | --- | ---: |
| `Import` | consolidated-source | 8.98 GB |
| `.tmp.driveupload` | temp/cache | 6.36 GB |
| `From：Pixel 9 Pro Fold` | consolidated-source | 4.7 GB |
| `DRIVES` | consolidated-source | 1.72 GB |
| `archive` | consolidated-source | 1.01 GB |
| `Scan` | consolidated-source | 896.93 MB |
| `trezor-firmware` | tooling | 565.59 MB |
| `recovery_env` | consolidated-source | 86.73 MB |
| `Crypto` | consolidated-source | 75.53 MB |
| `From：PC` | consolidated-source | 60.27 MB |
| `D_-20260309T041057Z-3-001.zip` | loose-root-file | 51.92 MB |

## Bucket Notes

### Import
- Class: `consolidated-source`
- Size: **8.98 GB**
- Role: stable holding area for imported or recovery-related material.
- Touch carefully: document and dedupe before relocating.
- Notable nested hotspots:
  - `Import\My Drive` (4.39 GB)
  - `Import\My Drive\RecoveryTransfers` (3.27 GB)
  - `Import\Other computers` (1.7 GB)
  - `Import\Other computers\USB and External Devices` (1.35 GB)
- Notable large files:
  - `Import\Other computers\USB and External Devices\DRIVES\Recovery - Copy - Copy.vhdx` (708 MB)
  - `Import\Other computers\USB and External Devices\DRIVES\Recovery - Copy.vhdx` (676 MB)
  - `Import\From Google Drive\USB and External Devices\Pixel 9 Pro Fold\Recovery\gate_8.8.0_8080000_02102228_20260210150523_sec.apk` (414.44 MB)

### .tmp.driveupload
- Class: `temp/cache`
- Size: **6.36 GB**
- Role: transient upload/download/cache material.
- Touch carefully: confirm it is expendable before clearing it.
- Notable large files:
  - `.tmp.driveupload\913777` (541.28 MB)
  - `.tmp.driveupload\858350` (507.58 MB)
  - `.tmp.driveupload\904414` (470.79 MB)

### From：Pixel 9 Pro Fold
- Class: `consolidated-source`
- Size: **4.7 GB**
- Role: stable holding area for imported or recovery-related material.
- Touch carefully: document and dedupe before relocating.
- Notable nested hotspots:
  - `From：Pixel 9 Pro Fold\DCIM` (4.7 GB)
  - `From：Pixel 9 Pro Fold\DCIM\DCIM` (3.99 GB)
  - `From：Pixel 9 Pro Fold\DCIM\DCIM\Camera` (3.03 GB)

### DRIVES
- Class: `consolidated-source`
- Size: **1.72 GB**
- Role: stable holding area for imported or recovery-related material.
- Touch carefully: document and dedupe before relocating.
- Notable nested hotspots:
  - `DRIVES\vhdx_extracted\Recovery-Primary` (811 MB)
  - `DRIVES\vhdx_extracted` (811 MB)
  - `DRIVES\VHDX` (734.2 MB)
- Notable large files:
  - `DRIVES\vhdx_extracted\Recovery-Primary\1.Storage pool.img` (683 MB)
  - `DRIVES\VHDX\{00278021-947B-4730-8278-BF76FBC77637}.vhdx` (217 MB)

### archive
- Class: `consolidated-source`
- Size: **1.01 GB**
- Role: stable holding area for imported or recovery-related material.
- Touch carefully: document and dedupe before relocating.
- Notable nested hotspots:
  - `archive\root_archives` (727.6 MB)
- Notable large files:
  - `archive\root_archives\944646` (280.01 MB)
  - `archive\root_archives\Dowloads.zip` (280.01 MB)

### Scan
- Class: `consolidated-source`
- Size: **896.93 MB**
- Role: stable holding area for imported or recovery-related material.
- Touch carefully: document and dedupe before relocating.
- Notable large files:
  - `Scan\full_inventory.txt` (293.4 MB)
  - `Scan\full_inventory_1.txt` (293.4 MB)

### trezor-firmware
- Class: `tooling`
- Size: **565.59 MB**
- Role: support code, environments, or automation assets.
- Touch carefully: low evidence risk, so this is a later cosmetic cleanup candidate.

### recovery_env
- Class: `consolidated-source`
- Size: **86.73 MB**
- Role: stable holding area for imported or recovery-related material.
- Touch carefully: document and dedupe before relocating.

### Crypto
- Class: `consolidated-source`
- Size: **75.53 MB**
- Role: stable holding area for imported or recovery-related material.
- Touch carefully: document and dedupe before relocating.

### From：PC
- Class: `consolidated-source`
- Size: **60.27 MB**
- Role: stable holding area for imported or recovery-related material.
- Touch carefully: document and dedupe before relocating.

## Loose Root Files To Eventually File

- `D_-20260309T041057Z-3-001.zip` (51.92 MB)

## Practical Next Step

- Treat the root as an index of major buckets.
- Focus cleanup on `.tmp.driveupload` and duplicate candidates first.
- Keep `Import`, `DRIVES`, `archive`, `Scan`, phone exports, and crypto/recovery material stable until you want a deliberate dedupe pass.

