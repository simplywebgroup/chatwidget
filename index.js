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

  app.get("/debug/token", (req, res) => {
    res.json(global.hlTokens || { error: "No tokens loaded" });
  });
  

  app.get("/test/contacts", async (req, res) => {
    try {
      const token = global.hlTokens?.access_token;
      const locationId = global.hlTokens?.locationId;
  
      if (!token || !locationId) {
        return res.status(400).json({ error: "Missing tokens" });
      }
  
      const resp = await axios.get(
        `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
          }
        }
      );
  
      res.json(resp.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });
  

  try {
    const qs = require("qs"); // Add this at the top with other requires

const tokenResponse = await axios.post(
  "https://services.leadconnectorhq.com/oauth/token",
  qs.stringify({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    grant_type: "authorization_code",
    code: code,
    user_type: "Location",
    redirect_uri: process.env.REDIRECT_URI
  }),
  {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
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
