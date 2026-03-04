import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const normalizeStatus = (status: string): string => {
  const s = status?.toUpperCase().trim()
  if (s === "FALIED") return "FAILED"
  return s
}

serve(async (req) => {
  try {
    const body = await req.json()
    console.log('Webhook Received:', body)

    const transaction_id = body.transaction_id || body.id
    const rawStatus = body.status || body.payment_status || 'PENDING'
    const status = normalizeStatus(rawStatus)

    if (transaction_id && status === 'COMPLETED') {
      const { data, error } = await supabase
        .from('deposits')
        .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
        .eq('transaction_id', transaction_id)
        .select()

      if (error) {
        console.error('Supabase Update Error:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
      }

      console.log('Deposit marked as COMPLETED:', data)
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })

  } catch (error: any) {
    console.error('Webhook Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
