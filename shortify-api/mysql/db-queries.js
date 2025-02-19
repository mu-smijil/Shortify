// db-queries.js
const db = require('./mysql-connection');
const timestamp = require('../functions/get-timestamp');

const getUser = async (googleId) => {
    return new Promise((resolve, reject) => {
        db.query(
            'SELECT * FROM users WHERE googleId = ?',
            [googleId],
            (err, results) => {
                if (err) {
                    console.error("Error getting user:", err);
                    reject(err);
                }
                resolve(results);
            }
        );
    });
};

const createUser = async (googleId, displayName, email) => {
    const time = timestamp();
    return new Promise((resolve, reject) => {
        db.query(
            'INSERT INTO users (googleId, displayName, email, createdAt) VALUES (?, ?, ?, ?)',
            [googleId, displayName, email, time],
            (err, result) => {
                if (err) {
                    console.error("Error creating user:", err);
                    reject(err);
                }
                console.log("Created a new account!");
                resolve(result);
            }
        );
    });
};

const fetchURL = async (customalias) => {
    return new Promise((resolve, reject) => {
        if (!customalias) {
            reject(new Error('Custom alias is required'));
            return;
        }
        db.query(
            'SELECT longUrl FROM short_urls WHERE customAlias = ?',
            [customalias],
            (err, results) => {
                if (err) {
                    console.error("Error fetching URL:", err);
                    reject(err);
                }
                resolve(results);
            }
        );
    });
};

/**
 * Create a new short URL entry in the database
 * @param {string} longUrl - The original long URL
 * @param {string} shortUrl - The generated short URL
 * @param {string|null} customAlias - Custom alias if provided, otherwise null
 * @param {number|null} userId - User ID if authenticated, otherwise null
 * @param {string|null} topic - Topic category if provided, otherwise null
 * @returns {Promise<Object>} - Result of the database operation
 */
const createShortURLEntry = async (longUrl, shortUrl, customAlias = null, userId = null, topic = null) => {
    const time = timestamp();
    
    console.log('Creating short URL with params:', {
        longUrl,
        shortUrl,
        customAlias,
        userId,
        topic,
        createdAt: time
    });
    
    return new Promise((resolve, reject) => {
        db.query(
            'INSERT INTO short_urls (googleId, longUrl, customAlias, topic, shortUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, longUrl, customAlias, topic, shortUrl, time],
            (err, result) => {
                if (err) {
                    console.error("Error creating short URL:", err);
                    reject(err);
                }
                console.log("Created a new short URL!");
                resolve(result);
            }
        );
    });
};

const createAnalaticsEntry = async (shortUrl, userId, os, deviceType) => {   
    return new Promise((resolve, reject) => {
        db.query(
            'INSERT INTO clicks (shortUrl, userId, os, deviceType) VALUES (?, ?, ?, ?)',
            [shortUrl, userId, os, deviceType],
            (err, result) => {
                if (err) {
                    console.error("Error creating short URL:", err);
                    reject(err);
                }
                console.log("Created a new analatics entry!");
                resolve(result);
            }
        );
    });
};

const recordClick = async (shortUrl, userId, os, deviceType, ipAddress) => {
    return new Promise((resolve, reject) => {
        db.query(
            `INSERT INTO link_clicks (shortUrl, userId, os, deviceType, ipAddress)
             VALUES (?, ?, ?, ?, ?)`,
            [shortUrl, userId, os, deviceType, ipAddress],
            (err, result) => {
                if (err) {
                    console.error("Error recording click:", err);
                    reject(err);
                }
                resolve(result);
            }
        );
    });
};

const getClickStats = async (shortUrl) => {
    return new Promise((resolve, reject) => {
        Promise.all([
            new Promise((resolve, reject) => {
                db.query(
                    'SELECT COUNT(*) as total FROM link_clicks WHERE shortUrl = ?',
                    [shortUrl],
                    (err, results) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(results[0]);
                    }
                );
            }),
            new Promise((resolve, reject) => {
                db.query(
                    `SELECT 
                        COUNT(DISTINCT CASE WHEN userId IS NOT NULL THEN userId ELSE ipAddress END) as unique_count
                     FROM link_clicks
                     WHERE shortUrl = ?`,
                    [shortUrl],
                    (err, results) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(results[0]);
                    }
                );
            })
        ]).then(([totalResult, uniqueResult]) => {
            resolve({
                totalClicks: totalResult.total,
                uniqueClicks: uniqueResult.unique_count
            });
        }).catch(err => {
            console.error("Error getting click stats:", err);
            reject(err);
        });
    });
};

module.exports = { 
    getUser, 
    createUser, 
    fetchURL, 
    createShortURLEntry, 
    createAnalaticsEntry, 
    recordClick, 
    getClickStats 
};