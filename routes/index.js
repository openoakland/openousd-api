const express = require('express')
const Router = require('express').Router
const Request = require('express').Request

const pg = require('pg')


const connectionName =
  process.env.INSTANCE_CONNECTION_NAME || 'openousd:us-central1:openousd-staging'
const dbUser = process.env.SQL_USER
const dbPassword = process.env.SQL_PASSWORD
const dbName = process.env.SQL_NAME

const pgConfig = {
  max: 1,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  host: `/cloudsql/${connectionName}`
}

// This specifies that numeric types in PostgreSQL
// should be conversted to floats in js
// https://github.com/brianc/node-pg-types/issues/28
var types = require('pg').types
types.setTypeParser(1700, 'text', parseFloat)


// if (process.env.NODE_ENV === 'production') {
//   pgConfig.host = `/cloudsql/${connectionName}`
//}

// Connection pools reuse connections between invocations,
// and handle dropped or expired connections automatically.
let pgPool

if (!pgPool) {
        pgPool = new pg.Pool(pgConfig)
}

const router = Router()

router.get('/departments', async (req, res, next) => {

    var year = 2018

    if("year" in req.query) {
        year = req.query.year
    }

    var query = `SELECT e.site_code as code, s.description as name,
                        SUM(e.ytd_actual) as spending,
                        SUM(e.adopted) as budget,
                        e.year
                    FROM expenditures e
                    LEFT JOIN sites s ON e.site_code = s.code
                    WHERE e.site_code >= 900
                    AND e.year = ${year}
                    GROUP BY e.site_code, s.description, e.year`

    let processor

    try {
        getData(query, res, processor)
    } catch(e) {
        res.status(500).send(err)
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

    var nodesQuery = `SELECT r.category as id, 'resource' as type --, e.resource_code as code, r.description
                      FROM expenditures e
                      LEFT JOIN resources r on r.code = e.resource_code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      -- AND e.ytd_actual > 0
                      GROUP BY r.category
                      HAVING SUM(e.ytd_actual) >= ${minSpend}


                      UNION ALL

                      SELECT DISTINCT(s.category) as id, 'site' as type --, e.site_code as code, s.category
                      FROM expenditures e
                      LEFT JOIN sites s on s.code = e.site_code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      GROUP BY s.category
                      HAVING SUM(e.ytd_actual) >= ${minSpend}`

    var resourceCol = "category"
    if (groupBy === "restricted") resourceCol = "type"

    var linksQuery = `SELECT SUM(e.ytd_actual) as value, s.category as target, r.${resourceCol} as source
                      FROM expenditures e
                      LEFT JOIN sites s ON e.site_code = s.code
                      LEFT JOIN resources r ON e.resource_code = r.code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      GROUP BY s.category, r.${resourceCol}
                      HAVING SUM(e.ytd_actual) >= ${minSpend}`

    var linksResourceTypeQuery = `UNION ALL

                      SELECT SUM(e.ytd_actual) as value, r.type as target, r.category as source
                      FROM expenditures e
                      LEFT JOIN sites s ON e.site_code = s.code
                      LEFT JOIN resources r ON e.resource_code = r.code
                      WHERE e.year = ${year}
                      AND e.site_code >= 900
                      GROUP BY r.category, r.type
                      HAVING SUM(e.ytd_actual) >= ${minSpend}`

    if (groupBy === "restricted") linksQuery = linksQuery + linksResourceTypeQuery

    const resourceTypeNodes = [
        {
          "id": "Restricted",
          "type": "resource_type"
        },
        {
          "id": "Unrestricted",
          "type": "resource_type"
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
