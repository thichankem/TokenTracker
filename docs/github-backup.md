# TokenTracker GitHub Backup

Automatic, continuous backup of your TokenTracker local data to GitHub so you
never lose your token-usage history — even when switching machines.

## What is backed up

Files from `~/.tokentracker/tracker/`:

- `queue.jsonl`, `project.queue.jsonl`, `session.queue.jsonl`, `auto-outcomes.jsonl`
- `cursors.json`, `config.json`, `cloud-sync-pref.json`, queue/state files

**Privacy:** only token-count data (never prompts/messages/conversation bodies).
Sensitive files such as `relay-cookies.json` are **excluded** by design.

Backups land on the **`tokentracker-backup`** branch of
`thichankem/TokenTracker` under `backup/`, keeping `main` clean.

> ⚠️ The `thichankem/TokenTracker` repo is currently **public**. Anyone can read
> the `tokentracker-backup` branch. To keep your usage stats private, make the
> repo **private** (GitHub → Settings → Danger Zone → Change visibility).

## Automatic backup (this machine)

A Windows Scheduled Task **`TokenTracker GitHub Backup`** runs the backup every
**6 hours** (plus once shortly after install). Re-create it anytime with:

```powershell
$node = (Get-Command node).Source
$script = (Resolve-Path "scripts\backup-tokentracker.js").Path
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory (Get-Location).Path
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName "TokenTracker GitHub Backup" -Action $action -Trigger $trigger -Force
```

## Manual backup

```bash
node scripts/backup-tokentracker.js
```

Only commits/pushes when the data actually changed (idempotent).

## Restore on a new machine

```bash
node scripts/restore-tokentracker.js
```

This clones the `tokentracker-backup` branch and copies the files back into
`~/.tokentracker/tracker`. Run it before your first `tracker sync` on the new
machine so your history carries over.

## Configuration

| Flag | Env var | Default |
|---|---|---|
| `--remote` | `TOKENTRACKER_BACKUP_REMOTE` | `https://github.com/thichankem/TokenTracker.git` |
| `--branch` | `TOKENTRACKER_BACKUP_BRANCH` | `tokentracker-backup` |
| `--data` | `TOKENTRACKER_BACKUP_DATA` | `~/.tokentracker/tracker` |
| `--work` | `TOKENTRACKER_BACKUP_WORK` | `~/.tokentracker/backup-git` |