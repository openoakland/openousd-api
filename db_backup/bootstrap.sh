# assumes there is already a database called openousd
pg_restore -U postgres --clean -d openousd /db_backup/snapshots/openousd_snapshot_2020-09-06_17-49.dump
