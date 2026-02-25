import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1];
        const supabase = await createClient();

        // 1. Auth check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return new NextResponse("Unauthorized", { status: 401 });

        const { data: membership } = await supabase
            .from("house_members")
            .select("house_id, houses(name)")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!membership?.house_id) {
            return new NextResponse("No house found", { status: 400 });
        }

        // 2. Fetch Context (Last 100 expenses + Members + Balance)
        // This acts as our "Knowledge Base" for the RAG system
        const [expensesRes, membersRes, splitsRes] = await Promise.all([
            supabase
                .from("shared_expenses")
                .select("amount:total_amount, description, category, date, paid_by, users(name)")
                .eq("house_id", membership.house_id)
                .order("date", { ascending: false })
                .limit(100),
            supabase
                .from("house_members")
                .select("user_id, users(name)")
                .eq("house_id", membership.house_id),
            supabase
                .from("expense_splits")
                .select("amount, is_paid, user_id, users(name), expense:shared_expenses(description)")
                .eq("is_paid", false)
                .limit(50)
        ]);

        // 2.5 Calculate Monthly Stats (Basic)
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

        const currentMonthExpenses = expensesRes.data?.filter(e => e.date.startsWith(currentMonth)) || [];
        const totalExpensesThisMonth = currentMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        const context = {
            house_name: membership.houses?.name,
            current_date: now.toLocaleDateString("es-AR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            stats: {
                expenses_this_month: totalExpensesThisMonth,
                expense_count_this_month: currentMonthExpenses.length
            },
            expenses: expensesRes.data?.map(e => {
                const user = Array.isArray(e.users) ? e.users[0] : e.users;
                return {
                    ...e,
                    paid_by_name: (user as any)?.name || "Alguien"
                };
            }),
            members: membersRes.data?.map(m => {
                const user = Array.isArray(m.users) ? m.users[0] : m.users;
                return (user as any)?.name;
            }),
            pending_debts: splitsRes.data?.map(s => {
                const user = Array.isArray(s.users) ? s.users[0] : s.users;
                const expense = Array.isArray(s.expense) ? s.expense[0] : s.expense;
                return {
                    debtor: (user as any)?.name,
                    amount: s.amount,
                    for: (expense as any)?.description
                };
            })
        };

        // 3. Prompt Engineering
        const systemPrompt = `
      Eres el asistente inteligente de la casa "${context.house_name}".
      
      HOY ES: ${context.current_date}
      
      DATOS MACRO (Mes Actual):
      - Total Gastado: $${context.stats.expenses_this_month} (${context.stats.expense_count_this_month} gastos)
      
      CONTEXTO DETALLADO:
      - Miembros: ${context.members?.join(", ")}
      - Gastos Recientes (Últimos 100): ${JSON.stringify(context.expenses)}
      - Deudas Pendientes: ${JSON.stringify(context.pending_debts)}

      INSTRUCCIONES:
      - Responde preguntas sobre finanzas de la casa.
      - Usa el contexto de fecha para entender "hoy", "ayer", "este mes".
      - Si te preguntan por totales, usa los DATOS MACRO o suma con cuidado.
      - IMPORTANTE: Usa formato Markdown para tu respuesta (negritas, listas, etc).
      - Sé amigable, usa emojis. 🏠💸
    `;

        // 4. Call LLM (OpenRouter/Gemini)
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://houseai.app",
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messages
                ]
            })
        });

        const aiData = await response.json();

        if (!response.ok) {
            console.error("OpenRouter API Error:", JSON.stringify(aiData, null, 2));
        }

        console.log("OpenRouter Response:", JSON.stringify(aiData, null, 2));

        const reply = aiData.choices?.[0]?.message?.content || "Lo siento, me quedé pensando. ¿Podrías preguntar de nuevo? (Debug: Check server logs)";

        return NextResponse.json({ role: "assistant", content: reply });

    } catch (error) {
        console.error("Chat Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
