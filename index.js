// import * as express from 'express';
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

exports.helloWorld = (req, res) => {
  let message = req.query.message || req.body.message || 'OpenOUSD!';
  res.status(200).send(message);
};


// if (process.env.NODE_ENV === 'production') {
//   pgConfig.host = `/cloudsql/${connectionName}`;
//}

// Connection pools reuse connections between invocations,
// and handle dropped or expired connections automatically.
let pgPool;

exports.postgresDemo = (req, res) => {
  // Initialize the pool lazily, in case SQL access isn't needed for this
  // GCF instance. Doing so minimizes the number of active SQL connections,
  // which helps keep your GCF instances under SQL connection limits.
  if (!pgPool) {
    pgPool = new pg.Pool(pgConfig);
  }

  pgPool.query('SELECT NOW() as now', (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send(err);
    } else {
      res.send(JSON.stringify(results));
    }
  });

  // Close any SQL resources that were declared inside this function.
  // Keep any declared in global scope (e.g. mysqlPool) for later reuse.
};
