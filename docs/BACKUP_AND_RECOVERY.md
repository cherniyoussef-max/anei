# Backup and recovery

Use managed PostgreSQL automatic backups and PITR when available. Keep encrypted backups in a separate failure domain.

Suggested policy must be adapted to business/legal needs:
- continuous/PITR or frequent snapshots;
- daily logical/managed backup;
- documented retention;
- encrypted off-site copy;
- quarterly restore drill at minimum before claiming recovery readiness.

## Restore drill
1. create isolated DB;
2. restore selected backup/PITR point;
3. run schema/migration verification;
4. run read-only business integrity checks and smoke tests;
5. record RPO/RTO achieved;
6. destroy isolated test environment securely.

Never test restore by overwriting the live database.
