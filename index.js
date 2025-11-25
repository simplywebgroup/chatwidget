const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());

// Debug: make sure env is loaded
console.log("Loaded CLIENT_ID:", process.env.CLIENT_ID);

// OAuth callback endpoint
app.get("/oauth/callback/chatbot", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Missing ?code parameter");
  }

  try {
    const tokenResponse = await axios.post(
      "https://services.leadconnectorhq.com/oauth/token",
      {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        user_type: "Location",
        redirect_uri: process.env.REDIRECT_URI
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        }
      }
    );

    console.log("TOKEN RESPONSE:", tokenResponse.data);

    // TEMP: store in memory
    global.hlTokens = tokenResponse.data;

    res.send("HighLevel Chatbot Successfully Connected!");
  } catch (err) {
    console.error(
      "Token exchange error:",
      err.response?.data || err.message
    );
    res.status(500).send("OAuth token exchange failed");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on PORT", port);
});
