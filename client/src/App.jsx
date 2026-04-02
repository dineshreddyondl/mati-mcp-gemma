import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const API_URL = import.meta.env.VITE_API_URL || "https://api.sumathi.ondl.in"

const SUGGESTIONS = [
  "What collections do we have?",
  "How many total orders?",
  "Show me latest 5 orders",
  "Count orders by status",
]

const LOADING_MESSAGES = [
  "Checking tons of records, hang tight...",
  "Crunching the numbers for you...",
  "Digging through the data warehouse...",
  "Almost there, fetching your results...",
  "Scanning thousands of orders...",
  "Building your report, just a moment...",
]

function downloadAsExcel(content, filename) {
  const rows = []
  const lines = content.split('\n')
  let inTable = false
  let headers = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').filter(c => c.trim() !== '').map(c => c.trim())
      if (cells.every(c => /^[-:]+$/.test(c))) continue
      if (!inTable) {
        headers = cells
        inTable = true
        rows.push(cells)
      } else {
        rows.push(cells)
      }
    } else {
      if (!inTable && trimmed) {
        rows.push([trimmed])
      }
    }
  }

  if (rows.length === 0) {
    rows.push(["Report Data"])
    rows.push([content])
  }

  let csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function SearchModal({ isOpen, onClose, messages }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus()
  }, [isOpen])

  if (!isOpen) return null

  const results = messages.filter(m =>
    m.role === 'assistant' && m.content.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search conversations..."
            className="search-input"
          />
          <button className="search-close" onClick={onClose}>Esc</button>
        </div>
        {query && (
          <div className="search-results">
            {results.length === 0 ? (
              <p className="search-empty">No results found</p>
            ) : (
              results.map((msg, i) => (
                <div key={i} className="search-result-item">
                  <p>{msg.content.substring(0, 200)}...</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0])
  const [darkMode, setDarkMode] = useState(() => {
    const saved = window.matchMedia('(prefers-color-scheme: dark)').matches
    return saved
  })
  const [searchOpen, setSearchOpen] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const loadingIntervalRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

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

  useEffect(() => {
    if (loading) {
      setLoadingMsg(LOADING_MESSAGES[0])
      let index = 0
      loadingIntervalRef.current = setInterval(() => {
        index = (index + 1) % LOADING_MESSAGES.length
        setLoadingMsg(LOADING_MESSAGES[index])
      }, 3000)
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }
    }
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current)
    }
  }, [loading])

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleHome = () => {
    setMessages([])
    setInput("")
  }

  const sendMessage = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return

    setInput("")
    const newMessages = [...messages, { role: "user", content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
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
        <div className="header-left">
          <button className="icon-btn" onClick={handleHome} title="New chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
        </div>
        <div className="header-center">
          <h1>Mati</h1>
          <p>Back-office data reporter</p>
        </div>
        <div className="header-right">
          <button className="icon-btn" onClick={() => setSearchOpen(true)} title="Search (Cmd+K)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <button className="icon-btn" onClick={() => setDarkMode(d => !d)} title="Toggle theme">
            {darkMode ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} messages={messages} />

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
                    <button
                      className="download-btn"
                      onClick={() => downloadAsExcel(msg.content, `mati-report-${i}`)}
                      title="Download as CSV/Excel"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download
                    </button>
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="message message-mati">
                <div className="mati-avatar">M</div>
                <div className="bubble">
                  <div className="typing"><span /><span /><span /></div>
                  <p className="loading-msg">{loadingMsg}</p>
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
