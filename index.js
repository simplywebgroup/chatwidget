const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const qs = require("qs");

dotenv.config();

const app = express();
app.use(express.json());

// Debug: make sure env is loaded
console.log("Loaded CLIENT_ID:", process.env.CLIENT_ID);

// =========================
// DEBUG TOKEN ENDPOINTS
// =========================

app.get("/debug/token", (req, res) => {
  res.json(global.hlTokens || { error: "No hlTokens set" });
});

app.get("/debug/location-token", (req, res) => {
  res.json(global.hlLocationToken || { error: "No hlLocationToken set" });
});

app.get("/debug/company-token", (req, res) => {
  res.json(global.hlCompanyToken || { error: "No hlCompanyToken set" });
});

app.get("/debug/base-token", (req, res) => {
  const baseToken = global.hlLocationToken || global.hlTokens;
  if (!baseToken) {
    return res.json({ error: "No token loaded" });
  }
  res.json({
    userType: baseToken.userType,
    locationId: baseToken.locationId,
    hasAccessToken: !!baseToken.access_token
  });
});

// =========================
// OAUTH CALLBACK
// =========================

app.get("/oauth/callback/chatbot", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send("Missing code");
    }

    const tokenResponse = await axios.post(
      "https://services.leadconnectorhq.com/oauth/token",
      qs.stringify({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.REDIRECT_URI
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Version: "2021-07-28"
        }
      }
    );

    const tokenData = tokenResponse.data;
    console.log("TOKEN RESPONSE:", tokenData);

    // Store in memory
    global.hlTokens = tokenData;

    // Store separately based on userType
    if (tokenData.userType === "Location") {
      global.hlLocationToken = tokenData;
      console.log("Stored LOCATION token:", {
        locationId: tokenData.locationId,
        companyId: tokenData.companyId
      });
    } else if (tokenData.userType === "Company") {
      global.hlCompanyToken = tokenData;
      console.log("Stored COMPANY token:", {
        companyId: tokenData.companyId,
        isBulkInstallation: tokenData.isBulkInstallation
      });
    }

    res.send("HighLevel Chatbot Successfully Connected!");
  } catch (err) {
    console.error(
      "Token exchange error:",
      err.response?.data || err.message
    );
    res.status(500).send("Token exchange failed");
  }
});

// =========================
// OPTIONAL: COMPANY -> LOCATION TOKEN
// (only needed if you’re using agency/company-level token)
// =========================

app.post("/setup/location-token", async (req, res) => {
  try {
    const base = global.hlCompanyToken || global.hlTokens;

    if (!base) {
      return res.status(400).json({ error: "No company token loaded" });
    }

    if (base.userType !== "Company") {
      return res.status(400).json({
        error: "Current token is not a Company token",
        userType: base.userType
      });
    }

    const companyToken = base.access_token;
    const companyId = base.companyId;

    if (!companyToken || !companyId) {
      return res
        .status(400)
        .json({ error: "Company token missing access_token or companyId" });
    }

    // 1) Get installed locations for this app
    const installedResp = await axios.get(
      "https://services.leadconnectorhq.com/oauth/installedLocations",
      {
        headers: {
          Authorization: `Bearer ${companyToken}`,
          Accept: "application/json",
          Version: "2021-07-28"
        }
      }
    );

    console.log("installedLocations response:", installedResp.data);

    const locations = installedResp.data?.locations || installedResp.data;

    if (!locations || !locations.length) {
      return res
        .status(400)
        .json({ error: "No installed locations found for this app" });
    }

    // For now, just take the first location
    const first = locations[0];
    const locationId = first.locationId || first.id || first.location_id;

    if (!locationId) {
      return res
        .status(400)
        .json({ error: "Could not find locationId in installedLocations" });
    }

    // 2) Exchange Company token + locationId for a LOCATION access token
    const locTokenResp = await axios.post(
      "https://services.leadconnectorhq.com/oauth/locationToken",
      qs.stringify({
        companyId,
        locationId
      }),
      {
        headers: {
          Authorization: `Bearer ${companyToken}`,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          Version: "2021-07-28"
        }
      }
    );

    console.log("Location token response:", locTokenResp.data);

    // Store Location token separately from Company token
    global.hlLocationToken = locTokenResp.data;

    res.json({
      message: "Location token created",
      locationId: locTokenResp.data.locationId,
      scope: locTokenResp.data.scope
    });
  } catch (err) {
    console.error(
      "Error creating location token:",
      err.response?.data || err.message
    );
    res.status(500).json({ error: "Failed to create location token" });
  }
});

// =========================
// TEST CONTACTS USING LOCATION TOKEN
// =========================

app.get("/test/contacts", async (req, res) => {
  try {
    // Always prefer the dedicated Location token
    const baseToken = global.hlLocationToken || global.hlTokens;

    if (!baseToken) {
      return res.status(400).json({ error: "No token loaded in memory" });
    }

    const locToken = baseToken.access_token;
    const locationId = baseToken.locationId;
    const userType = baseToken.userType;

    if (!locToken || !locationId) {
      return res.status(400).json({
        error: "Token is missing locationId or access_token",
        userType,
        debug: {
          hasAccessToken: !!locToken,
          locationId
        }
      });
    }

    const resp = await axios.get(
      `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}`,
      {
        headers: {
          Authorization: `Bearer ${locToken}`,
          Accept: "application/json"
          Version: "2021-07-28"
        }
      }
    );

    res.json(resp.data);
  } catch (err) {
    console.error("test/contacts error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

// =========================
// START SERVER
// =========================

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on PORT", port);
});
