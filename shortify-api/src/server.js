// server.js
require("dotenv").config({ path: "../.env" });
const express = require("express");
const app = express();
const passport = require("passport");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { getUser, createUser } = require("../mysql/db-queries");

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT);
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_SECRECT);
console.log("GOOGLE_CALLBACK_URL:", process.env.GOOGLE_CALLBACK_URL);

app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT,
      clientSecret: process.env.GOOGLE_SECRECT,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let existingUser = await getUser(profile.id);
        
        if (existingUser && existingUser.length > 0) {
          return done(null, existingUser[0]);
        }

        await createUser(profile.id, profile.displayName, profile.emails[0].value);
        const newUser = await getUser(profile.id);
        return done(null, newUser[0]);

      } catch (error) {
        console.error("Authentication error:", error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.googleId);
});

passport.deserializeUser(async (googleId, done) => {
  try {
    const users = await getUser(googleId);
    if (users && users.length > 0) {
      done(null, users[0]);
    } else {
      done(null, null);
    }
  } catch (error) {
    done(error, null);
  }
});

// Router
app.use("/", require("../routes/router"));

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: err.message || "An error occurred" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});