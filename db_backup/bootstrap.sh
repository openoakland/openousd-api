# assumes there is already a database called openousd
pg_restore -U postgres --clean -d openousd /db_backup/snapshots/openousd_snapshot_2024-11-19_23-48.dump
