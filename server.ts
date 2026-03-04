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

const SOPAY_API_URL = process.env.SOPAY_API_URL || "https://api.sopaybr.com/api";
const SOPAY_CLIENT_ID = process.env.SOPAY_CLIENT_ID;
const SOPAY_CLIENT_SECRET = process.env.SOPAY_CLIENT_SECRET;

// Helper to get Sopay JWT Token
async function getSopayToken() {
  try {
    const response = await fetch(`${SOPAY_API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: SOPAY_CLIENT_ID,
        client_secret: SOPAY_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Sopay Auth Error:", errorData);
      throw new Error("Failed to authenticate with Sopay");
    }

    const data = (await response.json()) as { token: string };
    return data.token;
  } catch (error) {
    console.error("getSopayToken error:", error);
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

    const sopayResponse = await fetch(`${SOPAY_API_URL}/payments/deposit`, {
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
      const errorData = await sopayResponse.json();
      console.error("Sopay Deposit Error:", errorData);
      return res.status(500).json({ error: "Failed to create Sopay deposit" });
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
  } catch (error) {
    console.error("Create Payment Error:", error);
    res.status(500).json({ error: "Internal server error" });
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
      // Find the payment
      const { data: payment, error: findError } = await supabase
        .from("payments")
        .select("*")
        .eq("external_id", external_id)
        .single();

      if (findError || !payment) {
        console.error("Payment not found for webhook:", external_id);
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
