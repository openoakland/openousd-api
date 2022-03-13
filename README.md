# Overview

OpenOUSD is a static site which doesn't use an API. The HTML and JS for every page is built by Gatsby ahead of time and then served by GitHub pages. At build time, Gatsby pulls data from several sources to generate the pages. One of those sources is a set of [static JSON files](https://github.com/openoakland/openousd-site/tree/main/data). This repository holds the database and a node seever which queries the database and applies some light logic to create those JSON files. The [openousd-site](https://github.com/openoakland/openousd-site) repo has a script called [build_json](https://github.com/openoakland/openousd-site/blob/main/scripts/build_json.py) which simplies calls the endpoints and saves the JSON to a file.

# Setup

**Note:** Requires [Docker Desktop](https://www.docker.com/products/docker-desktop) to be installed and running.

In the top directory, run `docker-compose up`

The database will pre-populate with the snapshot specified in `db_backup/bootstrap.sh`

The first time you run `docker-compose up`, the container will exit with errors that say it cannot drop tables because they do not exist. Those can be ignored. Looks like this:

```
postgres_1  | pg_restore: [archiver (db)] Error from TOC entry 186; 1259 16716 TABLE bargaining_units postgres
postgres_1  | pg_restore: [archiver (db)] could not execute query: ERROR:  table "bargaining_units" does not exist
postgres_1  |     Command was: DROP TABLE public.bargaining_units;
postgres_1  |
postgres_1  | pg_restore: [archiver (db)] Error from TOC entry 185; 1259 16710 TABLE all_resources postgres
postgres_1  | pg_restore: [archiver (db)] could not execute query: ERROR:  table "all_resources" does not exist
postgres_1  |     Command was: DROP TABLE public.all_resources;
postgres_1  |
postgres_1  | ERROR:  table "all_resources" does not exist
postgres_1  | STATEMENT:  DROP TABLE public.all_resources;
postgres_1  |
postgres_1  | WARNING: errors ignored on restore: 27
```

# Development

## Running the Postgres DB and Node "API"

After doing the setup above, you can run:

```
docker-compose up
```

This should start up the postgres db and node server.

**Note:** When you run the container in this way, it saves the previous db state and loads that. Follow instructions below for backing up and clearing the db container.

## Creating a database snapshot

If using Docker:
```
./db_backup/createSnapshot.sh
```
Or without Docker:

```
npm run createSnapshot
```

This should be done when you've modified the database locally and want to save the state. A new file is created in `db_backups`. Add and commit the file in git to save it.

To load your snapshot when a new container is started, follow the next set of steps...

## Clear / restore the DB

Right now, there isn't a script which clears the db and loads a snapshot. To clear and restore a snapshot:

1. Create a snapshot if you ever want to get back to your current state (see above)
2. To wipe things away, run `npm cleanDocker`  or `./db_backup/cleanDocker.sh` to get rid of the existing Docker containers.
3. Update `db_backup/backup.sh` with the snapshot you want to restore to
4. Repeat the setup instructions to load the snapshot

# Development - OpenOUSD "API" (Node)

## Adding / modifying endpoints

All the queries and endpoints are in `routes/index.js`. When you modify and save that file, the node server should restart and you can test out your changes by hitting an endpoint in the browser like:

```
http://localhost:8080/api/<your-endpoint>
```

## Updating the site data

Once you have the DB and the node server running, you can run `npm updateData` in the [openousd-site](https://github.com/openoakland/openousd-site) repo. This will call a series of endpoints on the node server and generate a new set of JSON files.

# Annual Database Updates

## Staffing

- **Year** - School years span multiple calendar years. OpenOUSD data uses the year that the school year started. So the 2018-19 school year would be `2018`. This might not be the case in the raw staffing data fromthe district, so confirm.
- **Site Code** - Either a school site or a centrally administered program. Some people working at school sites may be hired centrally and therefore may appear as part of a central program staff instead of a school site.
- **PosId = position id** - A specific position. The person filling the position can change, but the position id should remain the same.
- **JobClassId** - A type of job. For example, a Head Custodian, Level 1. There can be many positions with the same job class.
- **AssignmentId** - Assignment Id changes if the position moves between sites or if a new person occupies the position. So if a Head Custodian, Level 1 at a school site quits and a new person is hired or the position moves to a new school site, the position id remains the same but the assignment id increases incrementally.
- **FTEPct** - FTE stands for Full Time Equivalent. If someone works half time, they would be 0.5 FTE. If a postion is shared across 2 school sites there would eb 2 records for the same position id with 0.5 FTE for each site.
- **Resource Code** - Part of the CA Standard Accountign Code Structure (SACS), the resource code represents the funding source for the position. If a position has multiple funding sources, it will contain mutliple records. The FTE indicates what percentage of the position is funded by that resources
- **Object Code** - Also part of SACS. Each position has different types of costs. These are generally salary and benefits. Classified and certificated (teachers and school administrators) staff have different object codes.
- **BargUnitId** - These are acronyms for union representaiton / bargaining units. Oakland Education Association (OEA) is the teachers union.

**Modifications before uploading into database**

1. Confirm that the year represents the year that the school year started and adjust if not. 2018-19 school year should be `2018` for example.
2. Remove trailing whitespace. `job_class_id` and `bargaining_unit_id` columns might have trailing whitespace. The `TRIM` function does this in Excel.
3. Rename column headers to match the `staffing` table
4. Import CSV to `staffing` table in Postgres
