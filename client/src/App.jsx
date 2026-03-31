import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const SUGGESTIONS = [
  "What collections do we have?",
  "How many total orders?",
  "Show me latest 5 orders",
  "Count orders by status",
]

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(scrollToBottom, [messages, loading])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "46px"
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
    }
  }, [input])

  const sendMessage = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return

    setInput("")
    const newMessages = [...messages, { role: "user", content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Server error")
      }

      const data = await res.json()
      setMessages([
        ...newMessages,
        { role: "assistant", content: data.content, toolsUsed: data.toolsUsed || [] },
      ])
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: `Something went wrong: ${err.message}`, toolsUsed: [] },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Mati</h1>
        <p>Back-office data reporter</p>
      </header>

      <div className="messages">
        {messages.length === 0 && !loading ? (
          <div className="empty-state">
            <div className="empty-logo">M</div>
            <h2>Ask me about your data</h2>
            <p>I can query your orders, trips, tickets, and more. Ask in plain English.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion" onClick={() => sendMessage(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="message message-user">
                  <div className="bubble">{msg.content}</div>
                </div>
              ) : (
                <div key={i} className="message message-mati">
                  <div className="mati-avatar">M</div>
                  <div className="bubble">
                    {msg.toolsUsed?.length > 0 && (
                      <div className="tool-indicator">
                        <span className="tool-dot" />
                        Queried {msg.toolsUsed.join(", ")}
                      </div>
                    )}
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="message message-mati">
                <div className="mati-avatar">M</div>
                <div className="bubble">
                  <div className="typing"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="input-area">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data..."
            rows={1}
            disabled={loading}
          />
          <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className="input-footer">Mati queries your MongoDB via DeepSeek-V3</div>
      </div>
    </div>
  )
}
