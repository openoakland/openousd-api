# assumes there is already a database called openousd
pg_restore -U postgres --clean -d openousd /db_backup/snapshots/openousd_snapshot_2023-02-24_03-36-2021-22-update-fix-staff-roles.dump
