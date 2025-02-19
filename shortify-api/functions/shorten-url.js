const shortenUrl = (longurl, customalias = "default", topic = "Not provided by user") => {
    const shortCode = customalias || Math.random().toString(36).substr(2, 6);
    return shortCode
  };

  module.exports = shortenUrl
  