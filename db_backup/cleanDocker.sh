docker container rm openousd-api_postgres_1

docker volume prune

docker rmi openousd-api_postgres

# pg_restore -U postgres --clean -d openousd /db_backup/openousd_restore2.dump

# backup from GCloud
# pg_dump -h 35.227.139.9 -Fc -U postgres --clean  -C openousd > openousd_restore.dump

# take a local snapshot
# pg_dump -Fc -U postgres openousd > /db_backup/snapshots/openousd_snapshot_$(date +"%Y-%m-%d_%I-%M-%P").dump

