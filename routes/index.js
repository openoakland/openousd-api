const express = require('express')
const Router = require('express').Router
const Request = require('express').Request

const pg = require('pg')

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}


const connectionName =
  process.env.INSTANCE_CONNECTION_NAME || 'openousd:us-central1:openousd-staging'
const dbUser = process.env.SQL_USER
const dbPassword = process.env.SQL_PASSWORD
const dbName = process.env.SQL_NAME
const dbHost = process.env.SQL_HOST || `/cloudsql/${connectionName}`

const pgConfig = {
  max: 1,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  host: dbHost
}

// This specifies that numeric types in PostgreSQL
// should be conversted to floats in js
// https://github.com/brianc/node-pg-types/issues/28
var types = require('pg').types
types.setTypeParser(1700, 'text', parseFloat)


// Connection pools reuse connections between invocations,
// and handle dropped or expired connections automatically.
let pgPool

if (!pgPool) {
        pgPool = new pg.Pool(pgConfig)
}

const router = Router()

router.get('/central-programs', async (req, res, next) => {

    var year = 2018

    if("year" in req.query) {
        year = req.query.year
    }

    var includeStaffRoles = true
    var includeStaffBargainingUnits = true

    var centralProgramsQuery = `SELECT p.*,
                  staff.sum_fte as eoy_total_fte, staff.eoy_total_positions,
                  ROUND((1-(p.spending/NULLIF(p.budget,0)))*100,1) as remaining_budget_percent
                  FROM
                    (SELECT e.site_code as code, s.description as name, s.category,
                      SUM(e.ytd_actual) as spending,
                      SUM(e.budget) as budget,
                      e.year
                      FROM expenditures e
                      LEFT JOIN sites s ON e.site_code = s.code
                      WHERE e.site_code >= 900
                      AND e.site_code != 998
                      AND e.year = ${year}
                      GROUP BY e.site_code, s.description, e.year, s.category
                      HAVING SUM(e.ytd_actual) >= 0) p
                    LEFT JOIN (SELECT st.site_code,
                                      SUM(fte) as sum_fte,
                                      CAST(COUNT(DISTINCT(m.position_id)) AS INT) as eoy_total_positions
                      FROM
                        (SELECT position_id, MAX(assignment_id) as max_assignment
                        from staffing
                        WHERE year = ${year}
                        GROUP BY position_id) m,
                        staffing st
                      WHERE m.position_id = st.position_id
                      AND m.max_assignment = st.assignment_id
                      GROUP BY st.site_code) staff ON p.code = staff.site_code
                  ORDER BY p.name`

    var staffRolesQuery = `SELECT st.site_code,
                                  st.job_class_description as role_description,
                                  st.job_class_display_description as role_display_description,
                                  CAST(COUNT(DISTINCT(m.position_id)) AS INT) as eoy_total_positions_for_role
                            FROM
                                (SELECT position_id, MAX(assignment_id) as max_assignment
                                FROM staffing
                                 WHERE year = ${year}
                                GROUP BY position_id) m,
                            staffing st
                            WHERE m.position_id = st.position_id
                            AND m.max_assignment = st.assignment_id
                            AND st.site_code >= 900
                            AND year = ${year}
                            GROUP BY st.site_code, st.job_class_description, st.job_class_display_description`

    var staffBargainingUnitsQuery = `SELECT st.site_code,
                                      bu.abbreviation,
                                      bu.description,
                                      CAST(COUNT(DISTINCT(m.position_id)) AS INT) as eoy_total_staff_positions_for_bu
                                    FROM
                                      (SELECT position_id, MAX(assignment_id) as max_assignment
                                      FROM staffing
                                       WHERE year = ${year}
                                      GROUP BY position_id) m
                                    LEFT JOIN staffing st ON (m.position_id = st.position_id AND m.max_assignment = st.assignment_id)
                                    LEFT JOIN bargaining_units bu on st.bargaining_unit_id = bu.bargaining_unit
                                    WHERE
                                    st.site_code >= 900
                                    AND st.year = ${year}
                                    GROUP BY st.site_code, bu.abbreviation, bu.description
                                    ORDER BY st.site_code ASC`

    try {
        var programs = await pgPool.query(centralProgramsQuery)
        programs = programs.rows
        var staffRoles
        var rolesGroupedByProgram = {}

        if(includeStaffRoles) {
            var allStaffRoles = await pgPool.query(staffRolesQuery)
            staffRoles = allStaffRoles.rows
            rolesGroupedByProgram = staffRoles.reduce((r,row) => {
                // Bit of a hack for now
                // If there is a better role name in the database, send that instead of janky OUSD name
                if(row.role_display_description) {
                  row.role_description = row.role_display_description
                }
                delete row.role_display_description

                var code = row.site_code
                delete row.site_code

                r[code] = r[code] || []
                r[code].push(row)
                return r
            }, Object.create(null))

            programs = programs.map(program => {
                if(program.code in rolesGroupedByProgram) {
                  program.staff_roles = rolesGroupedByProgram[program.code]
                } else {
                  program.staff_roles = []
                }
                return program
            })

        }

        if(includeStaffBargainingUnits) {
            var allStaffBargainingUnits = await pgPool.query(staffBargainingUnitsQuery)
            staffBargainingUnits = allStaffBargainingUnits.rows
            staffBargainingUnitsGroupedByProgram = staffBargainingUnits.reduce((r,row) => {
                var code = row.site_code
                delete row.site_code

                r[code] = r[code] || []
                r[code].push(row)
                return r
            }, Object.create(null))

            programs = programs.map(program => {
                if(program.code in staffBargainingUnitsGroupedByProgram) {
                  program.staff_bargaining_units = staffBargainingUnitsGroupedByProgram[program.code]
                } else {
                  program.staff_bargaining_units = []
                }
                return program
            })

        }

        res.json(programs)
    } catch(e) {
        console.log(e)
        res.status(500).send(e)
    }

})

router.get('/central-programs/resources', async (req, res, next) => {

    var year = 2018

    if("year" in req.query) {
        year = req.query.year
    }

    var query = `SELECT e.resource_code as code, r.description as name, r.category,
                        SUM(e.ytd_actual) as spending,
                        SUM(e.budget) as budget,
                        e.year
                    FROM expenditures e
                    LEFT JOIN resources r ON e.resource_code = r.code
                    WHERE e.site_code >= 900
                    AND e.site_code != 998
                    AND e.year = ${year}
                    GROUP BY e.resource_code, r.description, e.year, r.category`

    let processor

    try {
        getData(query, res, processor)
    } catch(e) {
        res.status(500).send(e)
    }

})

router.get('/sankey', async (req, res, next) => {

    var year = 2018
    var minSpend = 100000
    var groupBy = null

    if("year" in req.query) {
        year = req.query.year
    }

    if("minSpend" in req.query) {
        minSpend = req.query.minSpend
    }

    if("groupBy" in req.query) {
        groupBy = req.query.groupBy
    }

    var nodesQuery = `SELECT r.category as id, 'resource' as type, SUM(ytd_actual) as total, string_agg(DISTINCT r.description, ', ') as subnodes --, e.resource_code as code, r.description
                      FROM expenditures e
                      LEFT JOIN resources r on r.code = e.resource_code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      AND e.site_code != 998
                      GROUP BY r.category
                      HAVING SUM(e.ytd_actual) > 0


                      UNION ALL

                      SELECT DISTINCT(s.category) as id, 'site' as type, SUM(ytd_actual) as total, string_agg(DISTINCT s.description, ', ') as subnodes --, e.site_code as code, s.category
                      FROM expenditures e
                      LEFT JOIN sites s on s.code = e.site_code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      AND e.site_code != 998
                      GROUP BY s.category
                      HAVING SUM(e.ytd_actual) > 0`

    var resourceCol = "category"
    if (groupBy === "restricted") resourceCol = "type"

    var linksQuery = `SELECT SUM(e.ytd_actual) as value, s.category as target, r.${resourceCol} as source
                      FROM expenditures e
                      LEFT JOIN sites s ON e.site_code = s.code
                      LEFT JOIN resources r ON e.resource_code = r.code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      AND e.site_code != 998
                      GROUP BY s.category, r.${resourceCol}
                      HAVING SUM(e.ytd_actual) >= ${minSpend}`

    var linksResourceTypeQuery = `UNION ALL

                      SELECT SUM(e.ytd_actual) as value, r.type as target, r.category as source
                      FROM expenditures e
                      LEFT JOIN sites s ON e.site_code = s.code
                      LEFT JOIN resources r ON e.resource_code = r.code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      AND e.site_code != 998
                      GROUP BY r.category, r.type
                      HAVING SUM(e.ytd_actual) >= ${minSpend}`

    if (groupBy === "restricted") linksQuery = linksQuery + linksResourceTypeQuery

    const resourceTypeNodes = [
        {
          "id": "Restricted",
          "type": "resource_type",
          "subnodes": ""
        },
        {
          "id": "Unrestricted",
          "type": "resource_type",
          "subnodes": ""
        }
    ]

    try {
        var nodes = await pgPool.query(nodesQuery)
        var links = await pgPool.query(linksQuery)

        nodes = nodes.rows
        if (groupBy === "restricted") nodes = nodes.concat(resourceTypeNodes)

        let result = {
          nodes: nodes,
          links: links.rows
        }

        res.json(result)
    } catch(e) {
        console.log(e.stack)
        throw new Error (e)
        res.status(500).send(e)
    }

})

const getData = (query, res, processor) => {

    // Initialize the pool lazily, in case SQL access isn't needed for this
    // GCF instance. Doing so minimizes the number of active SQL connections,
    // which helps keep your GCF instances under SQL connection limits.

    if (!pgPool) {
        pgPool = new pg.Pool(pgConfig)
    }

    pgPool.query(query, (err, results) => {
        if (err) {
          console.log(err)
          throw new Error (err)
        } else {
          res.json(results.rows)
        }
    })
}

module.exports = router
