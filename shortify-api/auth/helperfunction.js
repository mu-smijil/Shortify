async  (accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const name = profile.displayName;
      const email = profile.emails[0].value;
      const profilePic = profile.photos[0].value;

      const [existingUser] = await db.query("SELECT * FROM users WHERE google_id = ?", [googleId]);

      if (existingUser.length > 0) {
        return done(null, existingUser[0]); // User found, return user
      }

      const [newUser] = await db.query(
        "INSERT INTO users (google_id, name, email, profile_pic) VALUES (?, ?, ?, ?)",
        [googleId, name, email, profilePic]
      );

      return done(null, { id: newUser.insertId, googleId, name, email, profilePic });
    } catch (error) {
      return done(error, null);
    }
  }