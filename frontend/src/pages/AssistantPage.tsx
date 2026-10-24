import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  FileText,
  Receipt,
  Calendar,
  Compass,
  CornerDownLeft,
  Loader2,
  Bot,
  User as UserIcon,
  RotateCcw
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  LoadingState,
  EmptyState
} from '../components/common/GlassComponents';
import { assistantApi } from '../services/api';

const SUGGESTED_PROMPTS = [
  "What should I handle this week?",
  "Which bills are due soon?",
  "When is my next appointment?",
  "What documents are missing from my application?",
  "Whose birthday is coming up?"
];

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  source_references?: any[];
}

export const AssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgIndex, setSpeakingMsgIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Web Speech API recognition reference
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const hist = await assistantApi.getHistory(30);
        if (hist.length > 0) {
          setMessages(hist);
        } else {
          // Default greeting
          setMessages([
            {
              role: 'assistant',
              content: "Hello! I am Orbi, your private personal digital assistant. I have indexed your bills, documents, applications, and calendar events. How can I assist you right now?",
              source_references: []
            }
          ]);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadHistory();

    // Initialize Web Speech Recognition if supported
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputQuery(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || loading) return;

    const userMsg: Message = { role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await assistantApi.ask(q);
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.answer,
        source_references: res.source_references
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `I encountered an issue retrieving your records: ${err.message || 'Network error'}. Please try again.`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please type your query.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleSpeak = (text: string, index: number) => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (speakingMsgIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingMsgIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMsgIndex(null);
    utterance.onerror = () => setSpeakingMsgIndex(null);

    setSpeakingMsgIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-0.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Grounded Personal Intelligence</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-['Manrope']">
            Ask Orbi
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-full border border-white/5">
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            Zero-Hallucination Verified
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                isUser
                  ? 'bg-indigo-600 border-indigo-400/30 text-white'
                  : 'bg-[#0D1527] border-white/10 text-indigo-400'
              }`}>
                {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className={`max-w-[82%] rounded-2xl p-4 text-xs leading-relaxed space-y-2 border ${
                isUser
                  ? 'bg-indigo-600/20 border-indigo-500/30 text-slate-100 rounded-tr-none'
                  : 'bg-[#0D1527]/80 border-white/8 text-slate-200 rounded-tl-none shadow-lg'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Source Citations for assistant */}
                {!isUser && msg.source_references && msg.source_references.length > 0 && (
                  <div className="pt-2.5 border-t border-white/5 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Authentic Sources & Citations
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.source_references.map((ref: any, rIdx: number) => (
                        <div
                          key={rIdx}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 border border-white/5 text-[10px] text-indigo-300"
                        >
                          {ref.type === 'bill' && <Receipt className="w-3 h-3 text-amber-400" />}
                          {ref.type === 'document' && <FileText className="w-3 h-3 text-indigo-400" />}
                          {ref.type === 'event' && <Calendar className="w-3 h-3 text-purple-400" />}
                          {ref.type === 'workflow' && <Compass className="w-3 h-3 text-emerald-400" />}
                          <span>{ref.title || ref.type}: {ref.snippet}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio Read-Aloud trigger */}
                {!isUser && (
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => handleSpeak(msg.content, idx)}
                      className="text-slate-400 hover:text-indigo-400 flex items-center gap-1 text-[10px]"
                      title="Read aloud"
                    >
                      {speakingMsgIndex === idx ? (
                        <>
                          <VolumeX className="w-3 h-3 text-indigo-400" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3" />
                          <span>Speak</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#0D1527] border border-white/10 flex items-center justify-center text-indigo-400">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-[#0D1527]/80 border border-white/8 rounded-2xl rounded-tl-none p-4 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Checking Smart Memory records and personal calendar...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Pill Carousel */}
      <div className="py-2 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] text-slate-500 uppercase font-semibold shrink-0">Try:</span>
        {SUGGESTED_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            className="px-2.5 py-1 rounded-full bg-slate-900/60 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/30 text-[11px] text-slate-300 hover:text-indigo-200 whitespace-nowrap transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Box with Voice & Send */}
      <div className="pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center gap-2 rounded-2xl bg-[#0D1527]/90 border border-white/10 p-2 backdrop-blur-xl shadow-xl"
        >
          {/* Voice Input Button */}
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`p-2.5 rounded-xl transition-all ${
              isListening
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title={isListening ? "Listening... click to stop" : "Speak to Orbi (Speech to Text)"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            placeholder={isListening ? "Listening to your voice..." : "Ask Orbi anything about your bills, files, family, or schedule..."}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-xs focus:outline-none px-2"
          />

          <GlassButton
            type="submit"
            variant="primary"
            size="sm"
            disabled={!inputQuery.trim() || loading}
            icon={<Send className="w-3.5 h-3.5" />}
          >
            Send
          </GlassButton>
        </form>
      </div>
    </div>
  );
};
