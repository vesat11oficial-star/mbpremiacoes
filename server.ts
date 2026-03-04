import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Supabase client with Service Role Key for server-side operations
const supabaseUrl = process.env.SUPABASE_URL || "https://zbaaopdndnlckuornird.supabase.co";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const SOPAY_BASE_URL = (process.env.SOPAY_API_URL || "https://api.sopaybr.com").replace(/\/$/, "");
const SOPAY_CLIENT_ID = process.env.SOPAY_CLIENT_ID;
const SOPAY_CLIENT_SECRET = process.env.SOPAY_CLIENT_SECRET;

// Helper to get Sopay JWT Token
async function getSopayToken() {
  if (!SOPAY_CLIENT_ID || !SOPAY_CLIENT_SECRET) {
    console.error("CRITICAL: SOPAY_CLIENT_ID or SOPAY_CLIENT_SECRET is not defined in environment variables.");
    throw new Error("Sopay credentials missing. Please configure SOPAY_CLIENT_ID and SOPAY_CLIENT_SECRET.");
  }

  try {
    const authUrl = `${SOPAY_BASE_URL}/api/auth/login`;
    console.log(`Attempting Sopay Auth at: ${authUrl} with Client ID: ${SOPAY_CLIENT_ID.substring(0, 4)}...`);

    const response = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: SOPAY_CLIENT_ID,
        client_secret: SOPAY_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Non-JSON response" }));
      console.error("Sopay Auth Error Details:", {
        status: response.status,
        statusText: response.statusText,
        data: errorData,
        url: authUrl
      });
      
      if (response.status === 401) {
        throw new Error("Sopay Authentication Failed: Invalid Client ID or Client Secret. Check your credentials.");
      }
      
      throw new Error(`Failed to authenticate with Sopay: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { token: string };
    return data.token;
  } catch (error) {
    console.error("getSopayToken exception:", error);
    throw error;
  }
}

// 1. Endpoint to create PIX payment
app.post("/api/payments/create", async (req, res) => {
  try {
    const { amount, payer, userId, raffleId, quantity } = req.body;

    if (!amount || !payer || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const token = await getSopayToken();
    const externalId = `pay_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create payment record in Supabase first (status: PENDING)
    const { data: payment, error: dbError } = await supabase
      .from("payments")
      .insert([
        {
          external_id: externalId,
          amount: amount,
          status: "PENDING",
          user_id: userId,
          metadata: { raffleId, quantity, payer }
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error("Supabase Insert Error:", dbError);
      return res.status(500).json({ error: "Failed to create payment record" });
    }

    const callbackUrl = `${process.env.APP_URL}/api/sopay-callback`;
    const depositUrl = `${SOPAY_BASE_URL}/api/payments/deposit`;

    const sopayResponse = await fetch(depositUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: amount,
        external_id: externalId,
        clientCallbackUrl: callbackUrl,
        payer: {
          name: payer.name,
          email: payer.email,
          document: payer.document,
        },
      }),
    });

    if (!sopayResponse.ok) {
      const errorData = await sopayResponse.json().catch(() => ({ message: "Non-JSON response" }));
      console.error("Sopay Deposit Error Details:", {
        status: sopayResponse.status,
        statusText: sopayResponse.statusText,
        data: errorData,
        url: depositUrl
      });
      
      const errorMessage = errorData.message || "Falha ao criar depósito na Sopay";
      return res.status(sopayResponse.status).json({ 
        error: errorMessage,
        code: "SOPAY_DEPOSIT_ERROR"
      });
    }

    const sopayData = (await sopayResponse.json()) as {
      transaction_id: string;
      pix_qrcode?: string;
      pix_payload?: string;
    };

    // Update payment with transaction_id
    await supabase
      .from("payments")
      .update({ transaction_id: sopayData.transaction_id })
      .eq("id", payment.id);

    res.json({
      external_id: externalId,
      transaction_id: sopayData.transaction_id,
      pix_qrcode: sopayData.pix_qrcode,
      pix_payload: sopayData.pix_payload,
    });
  } catch (error: any) {
    console.error("Create Payment Error:", error);
    const status = error.message?.includes("Authentication Failed") ? 401 : 500;
    res.status(status).json({ 
      error: error.message || "Internal server error",
      code: status === 401 ? "AUTH_FAILED" : "SERVER_ERROR"
    });
  }
});

// 2. Webhook Callback from Sopay
app.post("/api/sopay-callback", async (req, res) => {
  console.log("Sopay Webhook Received:", req.body);
  
  try {
    const { transaction_id, status, external_id } = req.body;

    // Log the webhook
    await supabase.from("webhook_logs").insert([
      {
        provider: "sopay",
        payload: req.body,
        transaction_id: transaction_id,
        external_id: external_id
      }
    ]);

    if (status === "COMPLETED") {
      // Find the payment - try external_id first, then transaction_id
      let query = supabase.from("payments").select("*");
      
      if (external_id) {
        query = query.eq("external_id", external_id);
      } else if (transaction_id) {
        query = query.eq("transaction_id", transaction_id);
      } else {
        console.error("Webhook received without external_id or transaction_id");
        return res.status(400).json({ error: "Missing identifiers" });
      }

      const { data: payment, error: findError } = await query.single();

      if (findError || !payment) {
        console.error("Payment not found for webhook:", { external_id, transaction_id });
        return res.status(404).json({ error: "Payment not found" });
      }

      if (payment.status === "COMPLETED") {
        return res.json({ message: "Payment already processed" });
      }

      // Update payment status
      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "COMPLETED", transaction_id: transaction_id })
        .eq("id", payment.id);

      if (updateError) {
        console.error("Error updating payment status:", updateError);
        return res.status(500).json({ error: "Failed to update payment" });
      }

      // TRIGGER RAFFLE LOGIC HERE
      const { raffleId, quantity, payer } = payment.metadata;
      
      console.log(`Payment ${external_id} completed. Releasing raffle numbers for ${payer.name} (CPF: ${payment.user_id})...`);
      
      const { data: buyResult, error: buyError } = await supabase.rpc('buy_tickets', {
        p_raffle_id: raffleId,
        p_quantity: quantity,
        p_name: payer.name,
        p_cpf: payment.user_id,
        p_phone: payer.phone || '',
        p_total_value: payment.amount
      });

      if (buyError) {
        console.error("Error calling buy_tickets RPC:", buyError);
        // We might want to retry or log this failure specifically
      } else {
        console.log("Tickets purchased successfully via webhook:", buyResult);
      }
    }

    res.json({ status: "received" });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 3. Endpoint to check payment status (Polling fallback)
app.get("/api/payments/status/:externalId", async (req, res) => {
  try {
    const { externalId } = req.params;

    // Get payment from our DB
    const { data: payment, error: dbError } = await supabase
      .from("payments")
      .select("*")
      .eq("external_id", externalId)
      .single();

    if (dbError || !payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // If already completed in our DB, return it
    if (payment.status === "COMPLETED") {
      return res.json({ status: "COMPLETED" });
    }

    // Otherwise, check with Sopay directly if we have a transaction_id
    if (payment.transaction_id) {
      const token = await getSopayToken();
      const statusUrl = `${SOPAY_BASE_URL}/api/transactions/getStatusTransac/${payment.transaction_id}`;
      
      const sopayResponse = await fetch(statusUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (sopayResponse.ok) {
        const { status } = (await sopayResponse.json()) as { status: string };
        
        // If Sopay says it's completed but our DB doesn't know yet (webhook lag)
        if (status === "COMPLETED") {
          // We could trigger the release logic here too for extra safety
          // But for polling, just returning the status is usually enough if the webhook is expected to handle the DB update
          return res.json({ status: "COMPLETED" });
        }
        
        return res.json({ status });
      }
    }

    res.json({ status: payment.status });
  } catch (error) {
    console.error("Check Status Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
