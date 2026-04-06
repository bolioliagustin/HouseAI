"use client";
export const dynamic = "force-dynamic";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Sparkles, User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy el asistente de tu casa. 🏠✨\nPregúntame sobre gastos, quién debe plata o cuánto gastaron en el súper este mes.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      if (!res.ok) throw new Error("Error fetching response");

      const data = await res.json();
      setMessages((prev) => [...prev, data]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Ups, tuve un problema al pensar la respuesta. 😵‍💫 Intenta de nuevo." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-background/90 backdrop-blur-lg border-b border-border/40 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
                Asistente
            </h1>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 overflow-y-auto" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 shadow-inner ${
                  msg.role === "user"
                    ? "bg-secondary/10 text-secondary"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>


              <div
                className={`px-5 py-3 rounded-[20px] max-w-[80%] whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-secondary text-secondary-foreground rounded-tr-[4px] font-medium shadow-sm"
                    : "bg-card border border-border/40 text-foreground rounded-tl-[4px] shadow-sm leading-relaxed"
                }`}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <div className="markdown-content text-sm space-y-3">
                    <ReactMarkdown 
                        components={{
                            ul: ({node, ...props}) => <ul className="list-disc pl-4 space-y-1.5" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-4 space-y-1.5" {...props} />,
                            li: ({node, ...props}) => <li className="marker:text-primary" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-bold text-primary" {...props} />,
                        }}
                    >
                        {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                    <Bot className="w-5 h-5" />
                </div>
                <div className="px-5 py-4 bg-card border border-border/40 rounded-[20px] rounded-tl-[4px] shadow-sm">
                    <div className="flex gap-1.5 pt-1.5 pb-1.5">
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></span>
                    </div>
                </div>
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <div className="bg-background/80 backdrop-blur-md border-t border-border/40 p-4 sticky bottom-0">
        <div className="max-w-4xl mx-auto">
            <form onSubmit={sendMessage} className="relative flex items-center gap-2">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu consulta..."
                className="w-full pl-6 pr-14 py-4 rounded-[20px] border border-border/40 bg-card shadow-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-muted-foreground"
            />
            <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-3 bg-primary text-primary-foreground rounded-[16px] shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all font-bold"
            >
                <Send className="w-5 h-5" />
            </button>
            </form>
        </div>
      </div>
    </div>
  );
}
