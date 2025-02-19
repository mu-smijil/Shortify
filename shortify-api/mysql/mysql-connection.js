require("dotenv").config({path: "../.env"});
const mysql = require("mysql2");

const db = mysql.createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASS || "",
    database: process.env.MYSQL_DBNAME || "testdb",
    port: process.env.MYSQL_PORT || 3306
  });

module.exports = db;
