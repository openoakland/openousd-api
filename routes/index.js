const express = require('express')
const Router = require('express').Router
const Request = require('express').Request

const pg = require('pg')

require('dotenv').config({path: ".env.local"})
const dbUser = process.env.SQL_USER
const dbPassword = process.env.SQL_PASSWORD
const dbName = process.env.SQL_NAME
const dbHost = process.env.SQL_HOST

const pgConfig = {
  max: 10,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  host: dbHost,
  connectionTimeoutMillis: 4000,
  port: 5432
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

pgPool.on('error', (err, client) => console.log(err))



// Global defaults
const latestYear = 2019

const router = Router()

router.get('/central-programs', async (req, res, next) => {

    year = latestYear

    if("year" in req.query) {
        year = req.query.year
    }

    const includeStaffRoles = true
    const includeStaffBargainingUnits = true
    const includeTimeSeries = true

    const centralProgramsQuery = `SELECT p.*,
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

// Query to select multiple years of data
//                 SELECT p.*,
//                   staff.sum_fte as eoy_total_fte, staff.eoy_total_positions,
//                   ROUND((1-(p.spending/NULLIF(p.budget,0)))*100,1) as remaining_budget_percent
//                   FROM
//                     (SELECT e.site_code as code, s.description as name, s.category,
//                       SUM(e.ytd_actual) as spending,
//                       SUM(e.budget) as budget,
//                       e.year
//                       FROM expenditures e
//                       LEFT JOIN sites s ON e.site_code = s.code
//                       WHERE e.site_code >= 900
//                       AND e.site_code != 998
// --                       AND e.year = 2018
//                       GROUP BY e.site_code, s.description, e.year, s.category
//                       HAVING SUM(e.ytd_actual) >= 0) p
//                     LEFT JOIN (SELECT st.site_code,
//                                       SUM(fte) as sum_fte,
//                                       CAST(COUNT(DISTINCT(m.position_id)) AS INT) as eoy_total_positions,
//                       m.year
//                       FROM
//                         (SELECT position_id, MAX(assignment_id) as max_assignment, year
//                         from staffing
//                         GROUP BY position_id, year) m,
//                         staffing st
//                       WHERE m.position_id = st.position_id
//                       AND m.max_assignment = st.assignment_id
//                       GROUP BY st.site_code, m.year) staff ON p.code = staff.site_code and p.year = staff.year
//                   ORDER BY p.name

    const staffRolesQuery = `SELECT st.site_code,
                                COALESCE(jc.display,jc.description) as role_description,
                                CAST(COUNT(DISTINCT(m.position_id)) AS INT) as eoy_total_positions_for_role
                            FROM
                              (SELECT position_id, MAX(assignment_id) as max_assignment
                              FROM staffing
                               WHERE year = ${year}
                              GROUP BY position_id) m,
                            job_classes jc,
                            staffing st
                            WHERE m.position_id = st.position_id
                            AND st.job_class_id = jc.job_class_id
                            AND m.max_assignment = st.assignment_id
                            AND st.site_code >= 900
                            AND year = ${year}
                            GROUP BY st.site_code, jc.description, jc.display
                            ORDER BY st.site_code`

    const staffBargainingUnitsQuery = `SELECT st.site_code,
                                      bu.abbreviation,
                                      bu.description,
                                      CAST(COUNT(DISTINCT(m.position_id)) AS INT) as eoy_total_positions_for_bu
                                    FROM
                                      (SELECT position_id, MAX(assignment_id) as max_assignment
                                      FROM staffing
                                       WHERE year = ${year}
                                      GROUP BY position_id) m
                                    LEFT JOIN staffing st ON (m.position_id = st.position_id AND m.max_assignment = st.assignment_id)
                                    LEFT JOIN bargaining_units bu on TRIM(st.bargaining_unit_id) = bu.bargaining_unit
                                    WHERE
                                    st.site_code >= 900
                                    AND st.year = ${year}
                                    GROUP BY st.site_code, bu.abbreviation, bu.description
                                    ORDER BY st.site_code ASC`

    const timeSeriesQuery =   `WITH spending as (SELECT e.site_code,
                                      SUM(e.ytd_actual) as spending,
                                      SUM(e.budget) as budget,
                                      e.year
                                    FROM
                                      expenditures e
                                    WHERE e.site_code >=900
                                    GROUP BY e.site_code, e.year),

                                    staffing as (SELECT st.site_code,
                                      SUM(fte) as sum_fte,
                                      CAST(COUNT(DISTINCT(m.position_id)) AS INT) as eoy_total_positions,
                                      m.year
                                    FROM
                                      (SELECT position_id, MAX(assignment_id) as max_assignment, year
                                      from staffing
                                      GROUP BY position_id, year) m,
                                      staffing st
                                    WHERE m.position_id = st.position_id
                                      AND m.max_assignment = st.assignment_id
                                      AND st.site_code >=900
                                    GROUP BY st.site_code, m.year)

                                    SELECT
                                      st.site_code,
                                      st.year,
                                      st.eoy_total_positions,
                                      st.sum_fte as eoy_total_fte,
                                      sp.spending,
                                      sp.budget
                                    FROM staffing st
                                    JOIN spending sp
                                      ON st.year = sp.year AND st.site_code = sp.site_code
                                    ORDER BY st.site_code, st.year ASC`


    try {
        let programs = await pgPool.query(centralProgramsQuery)
        programs = programs.rows
        let staffRoles, timeSeriesData
        let rolesGroupedByProgram = {}
        let timeSeriesGroupedByProgram = {}

        if(includeStaffRoles) {
            let allStaffRoles = await pgPool.query(staffRolesQuery)
            staffRoles = allStaffRoles.rows
            rolesGroupedByProgram = staffRoles.reduce((r,row) => {
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
            let allStaffBargainingUnits = await pgPool.query(staffBargainingUnitsQuery)
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

        if(includeTimeSeries) {
          let timeSeriesData = await pgPool.query(timeSeriesQuery)
          timeSeriesData = timeSeriesData.rows

          timeSeriesData.forEach(row => {
            if(!(row.site_code in timeSeriesGroupedByProgram)) {
              timeSeriesGroupedByProgram[row.site_code] = {
                time_series: [],
              }
            }

            timeSeriesGroupedByProgram[row.site_code].time_series.push({
              year: row.year,
              eoy_total_fte: row.eoy_total_fte,
              eoy_total_positions: row.eoy_total_positions,
              spending: row.spending,
              budget: row.budget
            })

          })
        }

        programs = programs.map(program => {
          if(includeTimeSeries && (program.code in timeSeriesGroupedByProgram)) {
            program = { ...program, ...timeSeriesGroupedByProgram[program.code]}

            try {
              program.change_from_previous_year = {}

              const previousYear = year-1

              program.change_from_previous_year.previous_year = previousYear
              dataForPreviousYear = program.time_series.find(data => data.year === previousYear)

              for (const [key, value] of Object.entries(dataForPreviousYear)) {
                if(key === 'year') continue
                program.change_from_previous_year[key] = Number((program[key] - value).toFixed(2))
              }

            } catch(e) {
              console.log(`Previous year data not available for`, program.name, program.code, "\n", e)
            }

          }
          return program
        })
        res.json(programs)
    } catch(e) {
        console.log(e)
        res.status(500).send(e)
    }

})

router.get('/central-programs/resources', async (req, res, next) => {

    year = latestYear

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
                    GROUP BY e.resource_code, r.description, e.year, r.category
                    ORDER BY code`

    let processor

    try {
        getData(query, res, processor)
    } catch(e) {
        res.status(500).send(e)
    }

})

router.get('/central-programs/sankey', async (req, res, next) => {

    year = latestYear
    let minSpend = 100000
    let groupBy = null

    if("year" in req.query) {
        year = req.query.year
    }

    if("minSpend" in req.query) {
        minSpend = req.query.minSpend
    }

    if("groupBy" in req.query) {
        groupBy = req.query.groupBy
    }

    var nodesQuery = `SELECT r.category as id, 'resource' as type, e.site_code, SUM(ytd_actual) as total
                      FROM expenditures e
                      LEFT JOIN resources r on r.code = e.resource_code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      AND e.site_code != 998
                      GROUP BY r.category, e.site_code
                      HAVING SUM(e.ytd_actual) >= ${minSpend}

                      UNION ALL

                      SELECT o.short as id, 'object' as type, e.site_code, SUM(ytd_actual) as total
                      FROM expenditures e
                      LEFT JOIN objects o ON o.code = e.object_code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      AND e.site_code != 998
                      GROUP BY o.short, e.site_code
                      HAVING SUM(e.ytd_actual) >= ${minSpend}`

    var resourceCol = "category"
    if (groupBy === "restricted") resourceCol = "type"

    var linksQuery = `SELECT SUM(e.ytd_actual) as value, o.short as target, r.${resourceCol} as source, e.site_code
                      FROM expenditures e
                      LEFT JOIN sites s ON e.site_code = s.code
                      LEFT JOIN resources r ON e.resource_code = r.code
                      LEFT JOIN objects o ON o.code = e.object_code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      AND e.site_code != 998
                      GROUP BY o.short, r.${resourceCol}, e.site_code
                      HAVING SUM(e.ytd_actual) >= ${minSpend}
                      ORDER by e.site_code`

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
        links = links.rows
        if (groupBy === "restricted") nodes = nodes.concat(resourceTypeNodes)

        let centralProgramsSankey = nodes.reduce((r,row) => {
            var code = row.site_code
            delete row.site_code

            if (!row.id) {
              row.id = row.short
            }
            delete row.short

            r[code] = r[code] || { site_code: code, nodes: [], links: [] }
            r[code].nodes.push(row)
            return r
        }, Object.create(null))

        links.forEach(row => {
            var code = row.site_code
            delete row.site_code

            if (!row.target) {
              row.target = row.short
            }
            delete row.short

            centralProgramsSankey[code].links.push(row)
        })

        res.json(Object.values(centralProgramsSankey))
    } catch(e) {
        console.log(e.stack)
        throw new Error (e)
        res.status(500).send(e)
    }

})

router.get('/sankey', async (req, res, next) => {

    year = latestYear
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
