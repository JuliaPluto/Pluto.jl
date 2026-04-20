# CLAUDE.md

Notes for Claude Code working in this repo.

## Downloading CI failure logs

To grab the logs from the N most recent failed runs of a workflow (e.g. `FrontendTest.yml`) into a local folder for analysis:

```bash
# 1. List the failed runs as JSON (pick N with --limit)
gh run list --repo JuliaPluto/Pluto.jl --workflow FrontendTest.yml \
    --status failure --limit 20 \
    --json databaseId,displayTitle,createdAt,conclusion

# 2. For each databaseId, save the expanded job log
mkdir -p ci_logs_failed
for id in <id1> <id2> ...; do
    gh run view --repo JuliaPluto/Pluto.jl "$id" --log > "ci_logs_failed/${id}.log"
done
```

**Important:** use `gh run view --log`, **not** `gh run download`. `gh run download` fetches workflow *artifacts* (for `FrontendTest.yml` those are screenshot bundles), not the stdout/stderr of the jobs.

Each log is ~80–150 KB; 20 runs fit in ~2 MB. Search them with `Grep` for patterns like `FAIL __tests__`, `TimeoutError`, `AssertionError`, `ProtocolError`, or `Tests:.*failed`.
