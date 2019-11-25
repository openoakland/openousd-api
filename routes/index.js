const express = require('express');
const Router = require('express').Router;
const Request = require('express').Request;

const pg = require('pg');


const connectionName =
  process.env.INSTANCE_CONNECTION_NAME || 'openousd:us-central1:openousd-staging';
const dbUser = process.env.SQL_USER;
const dbPassword = process.env.SQL_PASSWORD;
const dbName = process.env.SQL_NAME;

const pgConfig = {
  max: 1,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  host: `/cloudsql/${connectionName}`
}


// if (process.env.NODE_ENV === 'production') {
//   pgConfig.host = `/cloudsql/${connectionName}`;
//}

// Connection pools reuse connections between invocations,
// and handle dropped or expired connections automatically.
let pgPool;
if (!pgPool) {
    pgPool = new pg.Pool(pgConfig);
}

const router = Router()

router.get('/', async (req, res, next) => {

    var query = 'SELECT * FROM objects LIMIT 10';

    let results, formatter;

    try {
        getData(query, res, formatter);
    } catch(e) {
        res.status(500).send(err);
    }

});

const getData = (query, res, formatter) => {

    // Initialize the pool lazily, in case SQL access isn't needed for this
    // GCF instance. Doing so minimizes the number of active SQL connections,
    // which helps keep your GCF instances under SQL connection limits.

    pgPool.query(query, (err, results) => {
        if (err) {
          console.error(err);
          throw new Error (err);
        } else {
          res.json(results.rows);
        }
    });
}

module.exports = router;
