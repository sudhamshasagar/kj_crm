import React, { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, onSnapshot, where, addDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebaseConfig";
import { 
  Search, MoreHorizontal, Smile, Paperclip, Send, 
  CheckCheck, User, Phone, Calendar, ChevronLeft
} from "lucide-react";

export default function CRMWhatsAppInbox() {
  const [conversations, setConversations] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /* ---------------- LOAD CONVERSATIONS ---------------- */
  useEffect(() => {
    const q = query(collection(db, "whatsapp_messages"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (!list.find((c) => c.phone === data.phone)) {
          list.push({
            phone: data.phone,
            lastMessage: data.message,
            time: data.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "New"
          });
        }
      });
      setConversations(list);
    });
    return () => unsub();
  }, []);

  /* ---------------- LOAD MESSAGES ---------------- */
  useEffect(() => {
    if (!selectedPhone) return;
    const q = query(
      collection(db, "whatsapp_messages"),
      where("phone", "==", selectedPhone),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [selectedPhone]);

  const sendReply = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim() || !selectedPhone) return;
    
    const currentText = text;
    setText(""); 

    try {
      const sendReplyFn = httpsCallable(functions, "sendWhatsAppReply");
      await sendReplyFn({ phone: selectedPhone, message: currentText });
      await addDoc(collection(db, "whatsapp_messages"), {
        phone: selectedPhone,
        message: currentText,
        direction: "outgoing",
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-screen w-full dashboard-bg flex items-center justify-center p-0 lg:p-6">
      <div className="flex w-full h-full max-w-7xl bg-white/80 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-white/50">
        
        {/* SIDEBAR */}
        <div className={`${selectedPhone ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] flex-col border-r border-gray-200 bg-white/40`}>
          {/* Admin Profile Header */}
          <div className="p-4 flex justify-between items-center border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden bg-gray-100">
                <img src="/kc2.png" alt="Admin" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Admin Panel</h3>
                <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Online
                </span>
              </div>
            </div>
            <MoreHorizontal size={20} className="text-gray-400 cursor-pointer" />
          </div>

          {/* Search Box */}
          <div className="p-4">
            <div className="relative group">
              <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={18} />
              <input 
                placeholder="Find customer..." 
                className="w-full bg-gray-100/50 border-none rounded-xl py-2.5 pl-10 text-sm focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto space-y-1 px-2">
            {conversations.map((c) => (
              <div
                key={c.phone}
                onClick={() => setSelectedPhone(c.phone)}
                className={`flex items-center p-3 rounded-xl cursor-pointer transition-all ${
                  selectedPhone === c.phone 
                  ? 'bg-orange-50 border border-orange-100 shadow-sm' 
                  : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-200 to-gray-100 flex items-center justify-center text-gray-500 font-bold mr-3 shadow-inner">
                  {c.phone.slice(-2)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-800">{c.phone}</span>
                    <span className="text-[10px] text-gray-400 font-medium">{c.time}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5 font-light">{c.lastMessage}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHAT WINDOW */}
        <div className={`${!selectedPhone ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-gray-50/30`}>
          {selectedPhone ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/60">
                <div className="flex items-center gap-4">
                  <ChevronLeft className="md:hidden text-gray-400" onClick={() => setSelectedPhone(null)} />
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                    {selectedPhone.slice(0, 1)}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 leading-none">{selectedPhone}</h2>
                    <p className="text-[11px] text-gray-400 mt-1 font-medium">WhatsApp Customer</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-gray-400">
                   <Phone size={18} className="cursor-pointer hover:text-orange-500 transition" />
                   <Calendar size={18} className="cursor-pointer hover:text-orange-500 transition" />
                </div>
              </div>

              {/* Messages Area */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4"
              >
                {messages.map((m) => (
                  <div key={m.id} className={`flex w-full ${m.direction === "incoming" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] p-3 px-4 rounded-2xl text-sm shadow-sm border ${
                      m.direction === "incoming" 
                      ? "bg-white text-gray-800 rounded-bl-none border-gray-100" 
                      : "bg-[#2563eb] text-white rounded-br-none border-blue-600"
                    }`}>
                      <p className="leading-relaxed">{m.message}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${m.direction === "incoming" ? "text-gray-400" : "text-blue-100"}`}>
                        {m.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {m.direction !== "incoming" && <CheckCheck size={14} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CRM Input Area */}
              <div className="p-4 bg-white/60 border-t border-gray-100">
                <form onSubmit={sendReply} className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-2 shadow-sm focus-within:border-orange-200 transition-all">
                  <Smile className="text-gray-400 cursor-pointer hover:text-orange-500" size={20} />
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a reply to user..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 text-gray-700"
                  />
                  <div className="flex items-center gap-3 border-l pl-3 border-gray-100">
                    <Paperclip className="text-gray-400 cursor-pointer hover:text-blue-500" size={18} />
                    <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-xl transition-all shadow-md shadow-orange-100">
                      <Send size={18} />
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center opacity-60">
              <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mb-4">
                <User size={40} className="text-orange-200" />
              </div>
              <p className="text-gray-400 font-medium">Select a user to start chatting</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .dashboard-bg {
          background: radial-gradient(1200px 600px at top left, #fff7ed 0%, #f9fafb 45%, #f3f4f6 100%);
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}