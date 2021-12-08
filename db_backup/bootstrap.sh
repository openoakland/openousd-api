# assumes there is already a database called openousd
pg_restore -U postgres --clean -d openousd /db_backup/snapshots/openousd_snapshot_2021-09-25_20-17-2020-21-expenditures.dump
