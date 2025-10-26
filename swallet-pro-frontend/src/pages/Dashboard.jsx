import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { dashboardAPI } from "../api";
import { useConversation } from '@elevenlabs/react';
import CryptoJS from "crypto-js";

async function elevenLabsTTS(text, apiKey) {
  const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      voice_settings: { stability: 0.5, similarity_boost: 0.5 },
    }),
  });
  if (!response.ok) throw new Error("TTS failed");
  const audioBlob = await response.blob();
  return URL.createObjectURL(audioBlob);
}

const currencyFormatter = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "USD",
});

const formatCurrency = (cents = 0) => currencyFormatter.format((cents || 0) / 100);

export default function Dashboard() {
  const [summary, setSummary] = useState({
    accounts: [],
    totals: {
      balance_cents: 0,
      available_credit_cents: 0,
      total_debits_cents: 0,
      total_credits_cents: 0,
    },
    upcoming: [],
    recent: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBalance, setShowBalance] = useState(false);

  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error: authError, user } = useAuth0();

  const [apiKey] = useState("sk_cfbc51c5e63ec30d18b3f310e1dfa1a4e13b407d6a6fd370");

  const conversation = useConversation({
    clientTools: {
      displayMessage: (parameters) => {
        alert(parameters.text);
        return 'Message displayed';
      },
    },
  });

  // Add a ref to keep track of the current audio
  const audioRef = React.useRef(null);

  navigator.mediaDevices.getUserMedia({ audio: true });

  // Chatbot UI state
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Hi! Ask me anything about your dashboard.' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = React.useRef(null);

  // Start speech recognition (improved for continuous conversation)
  function startRecording() {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }
    setIsRecording(true);
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let finalTranscript = '';
    recognition.onresult = (event) => {
      if (event.results && event.results.length > 0) {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
      }
    };
    recognition.onspeechend = () => {
      recognition.stop();
    };
    recognition.onend = () => {
      setIsRecording(false);
      if (finalTranscript.trim()) {
        handleChatSendVoice(finalTranscript);
      } else {
        setChatMessages(msgs => [...msgs, { sender: 'bot', text: 'Sorry, I did not catch that. Please try again.' }]);
      }
    };
    recognition.onerror = (event) => {
      setIsRecording(false);
      setChatMessages(msgs => [...msgs, { sender: 'bot', text: 'Speech recognition error. Please try again.' }]);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  // Stop speech recognition
  function stopRecording() {
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }

  // Chatbot send handler for voice
  async function handleChatSendVoice(transcript) {
    if (!transcript.trim()) return;
    const userMsg = { sender: 'user', text: transcript };
    setChatMessages(msgs => [...msgs, userMsg]);
    setChatLoading(true);
    try {
      // Here you can call your backend/chatbot API for a real answer
      let botReply = `You said: ${transcript}`;
      setChatMessages(msgs => [...msgs, { sender: 'bot', text: botReply }]);
      // Use ElevenLabs to reply in audio
      const replyAudioUrl = await elevenLabsTTS(botReply, apiKey);
      const replyAudio = new Audio(replyAudioUrl);
      replyAudio.play();
    } catch (err) {
      setChatMessages(msgs => [...msgs, { sender: 'bot', text: 'Sorry, something went wrong.' }]);
    }
    setChatLoading(false);
  }

  async function createGroup(e) {
    e.preventDefault();
    try {
      // Basic encryption for group name
      const encryptedName = CryptoJS.AES.encrypt(name, "swallet-basic-key").toString();
      const newGroup = await api.post("/groups", { name: encryptedName, currency });
      setGroups([newGroup, ...groups]); // update UI instantly
      setName("");
      setCurrency("USD");
    } catch (err) {
      console.error("Error creating group:", err);
      alert("Failed to create group.");
    }
  }

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      localStorage.removeItem("token");
      navigate("/", { replace: true });
      return;
    }
    if (user?.email) {
      localStorage.setItem("token", `fake|${user.email}`);
    }

    (async () => {
      try {
        const data = await dashboardAPI.getSummary();
        setSummary({
          accounts: data.accounts || [],
          totals: data.totals || summary.totals,
          upcoming: data.upcoming || [],
          recent: data.recent || [],
        });
      } catch (err) {
        console.error("Failed to load dashboard summary", err);
        setError("Unable to reach the dashboard API.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, isLoading, navigate, user]);

  const maskedValue = (value) => (showBalance ? formatCurrency(value) : "••••••");

  const totalCards = useMemo(
    () => [
      { label: "Global Balance", value: summary.totals.balance_cents },
      { label: "Available Credit", value: summary.totals.available_credit_cents },
      { label: "Total Debits", value: summary.totals.total_debits_cents },
      { label: "Total Credits", value: summary.totals.total_credits_cents },
    ],
    [summary.totals]
  );

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p>Loading…</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p style={{ color: "#b91c1c" }}>Authentication error</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (error) return <p style={{ color: "#b91c1c" }}>{error}</p>;

  return (
    <div className="page-stack">
      <div className="card-grid card-grid--2">
        <section className="card">
          <div className="page-header-sm">
            <div>
              <p className="eyebrow">Secure Overview</p>
              <h2 style={{ margin: 0 }}>Check balances at a glance</h2>
              <p className="muted">Toggle to reveal totals across every linked source.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowBalance((s) => !s)}
            >
              {showBalance ? "Hide amounts" : "Show amounts"}
            </button>
          </div>

          <div className="stat-grid" style={{ marginTop: "1.5rem" }}>
            {totalCards.map((card) => (
              <div key={card.label} className="stat-card">
                <h3>{card.label}</h3>
                <strong>{maskedValue(card.value)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="page-header-sm">
            <div>
              <p className="eyebrow">Quick Actions</p>
              <h2 style={{ margin: 0 }}>Move faster with shortcuts</h2>
            </div>
          </div>
          <div className="quick-links quick-links--icons" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="quick-link" onClick={() => navigate("/groups")}
              aria-label="Create Group">
              <span className="quick-link__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-6 7v-1c0-2.21 3.58-3 6-3s6 .79 6 3v1H6Z"/>
                </svg>
              </span>
              <span className="quick-link__label">Create Group</span>
            </button>
            <button type="button" className="quick-link" onClick={() => navigate("/groups")}
              aria-label="New Request">
              <span className="quick-link__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm1 11h4v2h-6V7h2Z"/>
                </svg>
              </span>
              <span className="quick-link__label">New Request</span>
            </button>
            <button type="button" className="quick-link" onClick={() => navigate("/accounts")}
              aria-label="Add Account">
              <span className="quick-link__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 6h16v2H4v12h16v-7h-6a3 3 0 0 1-3-3V6H4Zm9 0v4a1 1 0 0 0 1 1h6V6h-7Z"/>
                </svg>
              </span>
              <span className="quick-link__label">Add Account</span>
            </button>
            <button type="button" className="quick-link" onClick={() => navigate("/people")}
              aria-label="Invite Contact">
              <span className="quick-link__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm7 1h-2v2h-2v2h2v2h2v-2h2v-2h-2Z"/>
                </svg>
              </span>
              <span className="quick-link__label">Invite Contact</span>
            </button>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Upcoming</p>
            <h2 style={{ margin: 0 }}>Payments queue</h2>
          </div>
        </div>
        {summary.upcoming.length === 0 ? (
          <p className="muted">You&apos;re all clear. No payments are due.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Description</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.upcoming.map((payment) => {
                  const dueDate = payment.due_on || payment.due_date || payment.created_at;
                  return (
                    <tr key={payment.id}>
                      <td>{payment.group_name}</td>
                      <td>{payment.description || "—"}</td>
                      <td>{dueDate ? new Date(dueDate).toLocaleDateString() : "—"}</td>
                      <td>{payment.status}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(payment.amount_cents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="page-header-sm">
          <div>
            <p className="eyebrow">Recent</p>
            <h2 style={{ margin: 0 }}>Latest activity</h2>
          </div>
        </div>

        {summary.recent.length === 0 ? (
          <p className="muted">No activity just yet.</p>
        ) : (
          <ul className="list" style={{ marginTop: "1rem" }}>
            {summary.recent.map((tx) => (
              <li key={tx.id} className="list-item transaction-row">
                <div>
                  <strong>{tx.group_name}</strong>
                  <p className="muted">{tx.description || tx.type}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>{formatCurrency(tx.amount_cents)}</strong>
                  <p className="muted">{new Date(tx.created_at).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* Chatbot Floating Button */}
      <div style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        zIndex: 1000,
      }}>
        <button
          onClick={() => setShowChatbot(true)}
          style={{
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            fontSize: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            cursor: 'pointer',
          }}
          title="Chatbot: Start conversation"
        >
          💬
        </button>
      </div>
      {/* ElevenLabs Convai Widget Embed */}
      <div id="elevenlabs-convai-widget" style={{ position: 'fixed', bottom: '2rem', right: '6rem', zIndex: 1100 }}>
        <elevenlabs-convai agent-id="agent_8101k8fxvddxf998egtfx07qpfjb"></elevenlabs-convai>
      </div>
      <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>
      {/* Chatbot Modal */}
      {showChatbot && (
        <div style={{
          position: 'fixed',
          bottom: '5rem',
          right: '2rem',
          width: '320px',
          background: '#222',
          color: '#fff',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Chatbot</span>
            <button onClick={() => setShowChatbot(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✖️</button>
          </div>
          <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', maxHeight: '260px' }}>
            {chatMessages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '0.5rem', textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
                <span style={{
                  background: msg.sender === 'user' ? '#007bff' : '#444',
                  color: '#fff',
                  padding: '0.5rem 1rem',
                  borderRadius: '16px',
                  display: 'inline-block',
                  maxWidth: '80%',
                  wordBreak: 'break-word',
                }}>{msg.text}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid #333', padding: '0.5rem', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              style={{ padding: '0.5rem 1rem', background: isRecording ? '#b91c1c' : '#007bff', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              disabled={chatLoading}
            >
              {isRecording ? 'Stop' : 'Speak'}
            </button>
            {isRecording && <span style={{ color: '#ff5252' }}>Listening…</span>}
          </div>
        </div>
      )}
    </div>
  );
}
