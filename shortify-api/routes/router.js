const express = require("express");
const router = express.Router();
const passport = require("passport");
const rateLimit = require("express-rate-limit");
const { fetchURL, createShortURLEntry, createAnalaticsEntry } = require('../mysql/db-queries');
const shortenUrl = require("../functions/shorten-url");
const timeStamp = require('../functions/get-timestamp');
const UAParser = require("ua-parser-js");

function detectOS(userAgent) {
    const parser = new UAParser(userAgent);
    return parser.getOS().name || "Unknown";
}

function detectDevice(userAgent) {
    const parser = new UAParser(userAgent);
    const device = parser.getDevice().type;
    return device === "mobile" ? "Mobile" : "Desktop";
}

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated. Please login first." });
};

const shortUrlRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth routes
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/fail" }),
  (req, res) => {
    const redirectUrl = process.env.REDIRECT_URL || "http://localhost:3000/ui/shorten";
    res.redirect(redirectUrl);
  }
);

// Logout route
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie('connect.sid');
    res.redirect("/test");
  });
});

// Protected profile route
router.get("/profile", isAuthenticated, (req, res) => {
  res.json({
    user: req.user
  });
});

// URL shortener routes - Now properly handles user authentication
router.post("/api/shorten", shortUrlRateLimiter, async(req, res) => {
  try {
    const { longurl, customalias, topic } = req.body;

    if (!longurl) {
      return res.status(400).json({ error: "Long URL is required" });
    }

    // Validate URL format
    try {
      new URL(longurl);
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const userAgent = req.headers["user-agent"];
    
    const os = detectOS(userAgent);
    const deviceType = detectDevice(userAgent);

    // Generate short URL
    const shortUrl = shortenUrl(longurl, customalias, topic);
    const time = timeStamp();
    
    // Get user ID if authenticated
    let userId = null;
    if (req.isAuthenticated() && req.user) {
      userId = req.user.googleId; // Make sure this matches your user object structure
    }
    
    // Create the short URL entry
    await createShortURLEntry(longurl, shortUrl, customalias, userId, topic);
    await createAnalaticsEntry(shortUrl,userId,os,deviceType)
    res.json({
      message: "Short URL created successfully",
      shortUrl,
      longurl,
      CreatedAt: time,
    });
  } catch (error) {
    console.error("Error creating short URL:", error);
    res.status(500).json({ 
      error: "Failed to create short URL",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/api/shorten', async (req, res) => {
  try {
    const { customalias } = req.query;
    
    if (!customalias) {
      return res.status(400).json({ error: "Custom alias parameter is required" });
    }
    
    const result = await fetchURL(customalias);
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "URL not found" });
    }
    res.redirect(result[0].longUrl);
  } catch (error) {
    console.error("Error fetching URL:", error);
    res.status(500).json({ error: "Failed to fetch URL" });
  }
});

router.get('/ui/shorten', (req, res) => {
  // Check if user is authenticated
  const isUserAuthenticated = req.isAuthenticated();
  const userName = isUserAuthenticated ? req.user.displayName : null;
  
  res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>URL Shortener</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            form {
              display: flex;
              flex-direction: column;
              gap: 15px;
            }
            input {
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
            }
            button {
              padding: 10px;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }
            button:hover {
              background-color: #0056b3;
            }
            .user-info {
              margin-bottom: 20px;
              padding: 10px;
              background-color: #f8f9fa;
              border-radius: 4px;
            }
            .message {
              padding: 10px;
              margin: 10px 0;
              border-radius: 4px;
            }
            .error {
              background-color: #f8d7da;
              color: #721c24;
            }
            .success {
              background-color: #d4edda;
              color: #155724;
            }
            .loading {
              display: none;
              margin-top: 15px;
            }
          </style>
      </head>
      <body>
          ${isUserAuthenticated ? `
          <div class="user-info">
            <p>Logged in as: ${userName}</p>
            <a href="/logout">Logout</a>
          </div>
          ` : `
          <div class="user-info">
            <p>Not logged in. <a href="/auth/google">Login with Google</a> to save your shortened URLs.</p>
          </div>
          `}
          
          <h2>Shorten a URL</h2>
          <form id="shortenForm">
              <label for="longurl">Long URL:</label>
              <input type="url" id="longurl" name="longurl" required placeholder="https://example.com">
              
              <label for="customalias">Custom Alias (optional):</label>
              <input type="text" id="customalias" name="customalias" placeholder="my-custom-url">
              
              <label for="topic">Topic (optional):</label>
              <input type="text" id="topic" name="topic" placeholder="technology, sports, etc.">
              
              <button type="submit">Shorten URL</button>
          </form>
          <div id="loading" class="loading">Processing request...</div>
          <div id="result"></div>

          <script>
            document.getElementById('shortenForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              
              document.getElementById('loading').style.display = 'block';
              document.getElementById('result').innerHTML = '';
              
              const formData = {
                longurl: document.getElementById('longurl').value,
                customalias: document.getElementById('customalias').value || '',
                topic: document.getElementById('topic').value || ''
              };

              try {
                const response = await fetch('/api/shorten', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(formData),
                  credentials: 'same-origin' // Include cookies for auth
                });

                const data = await response.json();
                document.getElementById('loading').style.display = 'none';
                
                if (response.ok) {
                  document.getElementById('result').innerHTML = 
                    \`<div class="message success">
                      <p>Short URL created: <a href="\${data.longurl}" target="_blank">\${data.shortUrl}</a></p>
                      <p>Long URL: \${data.longurl}</p>
                      <p>Created at: \${data.CreatedAt}</p>
                     </div>\`;
                  document.getElementById('shortenForm').reset();
                } else {
                  document.getElementById('result').innerHTML = 
                    \`<div class="message error">
                      <p>Error: \${data.error}</p>
                      \${data.details ? \`<p>Details: \${data.details}</p>\` : ''}
                     </div>\`;
                }
              } catch (error) {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('result').innerHTML = 
                  '<div class="message error"><p>Network error when creating short URL</p></div>';
                console.error("Fetch error:", error);
              }
            });
          </script>
      </body>
      </html>
  `);
});

// Test route
router.get("/test", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>URL Shortener - Login</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .login-container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
          }
          h1 {
            color: #333;
          }
          .login-btn {
            display: inline-block;
            background-color: #4285F4;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            text-decoration: none;
            margin-top: 20px;
            font-weight: bold;
          }
          .anon-link {
            margin-top: 20px;
            color: #666;
          }
        </style>
    </head>
    <body>
        <div class="login-container">
          <h1>URL Shortener</h1>
          <p>Create and manage your shortened URLs with our simple tool.</p>
          <a href='/auth/google' class="login-btn">Login with Google</a>
          <p class="anon-link">Or <a href="/ui/shorten">continue without logging in</a></p>
        </div>
    </body>
    </html>
  `);
});

// Auth failure route
router.get("/fail", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authentication Failed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f8d7da;
            color: #721c24;
          }
          .error-container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
          }
          h1 {
            color: #721c24;
          }
          .btn {
            display: inline-block;
            background-color: #6c757d;
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            text-decoration: none;
            margin-top: 20px;
          }
        </style>
    </head>
    <body>
        <div class="error-container">
          <h1>Authentication Failed</h1>
          <p>Google authentication was unsuccessful. Please try again.</p>
          <a href='/test' class="btn">Return to Home</a>
        </div>
    </body>
    </html>
  `);
});

module.exports = router;