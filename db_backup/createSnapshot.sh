docker exec -it openousd-api_postgres_1 bash -c 'pg_dump -Fc -h localhost -U postgres openousd > /db_backup/snapshots/openousd_snapshot_$(date +'%Y-%m-%d_%H-%M').dump'
