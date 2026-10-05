import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShieldAlert, TrendingUp, Cpu, Sliders, MessageSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Seus dados reais do Supabase configurados
const SUPABASE_URL = "https://wvyllpbqtahxrqsjjzgp.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2eWxscGJxdGFoeHJxc2pqemdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzU3NzEsImV4cCI6MjEwNjgxMTc3MX0.7qIsu2oZermD9uPA8ggSfNZuKDZH-_ifs2jJjeTX6XM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export default function App() {
  const [config, setConfig] = useState({
    prop_name: 'FTMO',
    account_size: 100000,
    daily_loss_limit: 5000,
    profit_target: 10000,
    active_symbol: 'XAUUSD',
    timeframe: 'M5',
    risk_per_trade_pct: 0.25,
    auto_trade: true,
    killswitch: false
  });

  const [telemetry, setTelemetry] = useState({
    equity: 100000,
    balance: 100000,
    daily_pnl: 0,
    current_spread: 1.2,
    ai_status: 'Aguardando inicialização do MT5...'
  });

  const [activeTab, setActiveTab] = useState('form');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou o Alex, seu funcionário trader. Estou pronto para monitorar sua conta da mesa.' }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [groqKey, setGroqKey] = useState('');

  // Sincronização em Tempo Real com o Supabase
  useEffect(() => {
    supabase.from('prop_config').select('*').eq('id', 1).single().then(r => {
      if (r.data) setConfig(r.data);
    });

    supabase.from('bot_telemetry').select('*').eq('id', 1).single().then(r => {
      if (r.data) setTelemetry(r.data);
    });

    const channel = supabase.channel('realtime_desk')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prop_config' }, payload => setConfig(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bot_telemetry' }, payload => setTelemetry(payload.new))
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const updateConfig = async (fields) => {
    setConfig(prev => ({ ...prev, ...fields }));
    await supabase.from('prop_config').update(fields).eq('id', 1);
  };

  const handleChat = async () => {
    if (!inputMsg.trim()) return;
    const userText = inputMsg;
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInputMsg('');

    if (!groqKey) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: 'Dica: Cole sua chave gratuita da Groq Cloud no campo acima para eu raciocinar e mudar as ordens dinamicamente.' 
      }]);
      return;
    }

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `Você é Alex, um funcionário trader institucional de mesa proprietária.
Config atual: Ativo=${config.active_symbol}, Risco=${config.risk_per_trade_pct}%, Saldo=${config.account_size}, Trava Diária=${config.daily_loss_limit}.
Se o usuário pedir alteração de parâmetros, responda com tom profissional e termine OBRIGATORIAMENTE incluindo um JSON no formato: {"active_symbol": "...", "risk_per_trade_pct": 0.2, ...}`
            },
            ...messages,
            { role: 'user', text: userText }
          ]
        })
      });

      const data = await res.json();
      const reply = data.choices[0].message.content;

      if (reply.includes('{') && reply.includes('}')) {
        const jsonMatch = reply.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          await updateConfig(parsed);
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', text: reply.replace(/\{[\s\S]*?\}/g, '') }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Erro ao conectar à API da IA. Verifique sua chave.' }]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      {/* Top Header */}
      <header className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 mb-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
            <Cpu size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-wide">{config.prop_name} Desk Copilot</h1>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                {config.active_symbol} • {config.timeframe}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Equity: <strong className="text-white">${telemetry.equity?.toLocaleString() || '100,000'}</strong> | Saldo: ${telemetry.balance?.toLocaleString() || '100,000'}
            </p>
          </div>
        </div>

        <button
          onClick={() => updateConfig({ killswitch: true, auto_trade: false })}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg ${
            config.killswitch 
              ? 'bg-amber-600 text-white animate-pulse' 
              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-950/50'
          }`}>
          <ShieldAlert size={18} />
          {config.killswitch ? 'KILLSWITCH ATIVADO' : 'EMERGENCY KILLSWITCH'}
        </button>
      </header>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna 1: Métricas de Risco da Mesa */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2 mb-4">
              <TrendingUp size={16} /> Limites da Mesa
            </h2>

            {/* Trava Diária */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5 font-mono">
                <span className="text-slate-400">Drawdown Diário</span>
                <span className="text-amber-400 font-bold">${Math.abs(telemetry.daily_pnl || 0)} / ${config.daily_loss_limit}</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (Math.abs(telemetry.daily_pnl || 0) / (config.daily_loss_limit || 1)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Meta de Lucro */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5 font-mono">
                <span className="text-slate-400">Progresso da Meta</span>
                <span className="text-emerald-400 font-bold">${config.profit_target}</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full w-[25%]" />
              </div>
            </div>

            {/* Telemetria Rápida */}
            <div className="pt-4 border-t border-slate-800/80 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Auto-Trading:</span>
                <span className={`font-bold flex items-center gap-1 ${config.auto_trade ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {config.auto_trade ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {config.auto_trade ? 'ATIVADO' : 'PAUSADO'}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-400">Spread do Ativo:</span>
                <span className="text-slate-200">{telemetry.current_spread} pips</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status IA:</span>
                <span className="text-blue-400 font-medium truncate max-w-[180px]">{telemetry.ai_status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 2 e 3: Central Interativa (Formulário + Chat) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[520px] shadow-lg">
          <div className="flex border-b border-slate-800 bg-slate-900/60 rounded-t-xl">
            <button
              onClick={() => setActiveTab('form')}
              className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                activeTab === 'form' ? 'border-blue-500 text-blue-400 bg-slate-800/40' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}>
              <Sliders size={16} /> Ajuste Rápido (Formulário)
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                activeTab === 'chat' ? 'border-blue-500 text-blue-400 bg-slate-800/40' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}>
              <MessageSquare size={16} /> Chat Copiloto (IA)
            </button>
          </div>

          {/* ABA DO FORMULÁRIO */}
          {activeTab === 'form' && (
            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Ativo em Operação</label>
                  <select 
                    value={config.active_symbol}
                    onChange={e => updateConfig({ active_symbol: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500">
                    <option value="XAUUSD">XAUUSD (Ouro)</option>
                    <option value="US30">US30 (Dow Jones)</option>
                    <option value="NAS100">NAS100 (Nasdaq)</option>
                    <option value="EURUSD">EURUSD</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Timeframe</label>
                  <select 
                    value={config.timeframe}
                    onChange={e => updateConfig({ timeframe: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500">
                    <option value="M1">M1 (Scalping Rápido)</option>
                    <option value="M5">M5 (SMC Estrutural)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Risco por Trade</span>
                  <span className="font-bold text-blue-400 font-mono">{config.risk_per_trade_pct}%</span>
                </div>
                <input 
                  type="range" min="0.1" max="1.0" step="0.05"
                  value={config.risk_per_trade_pct || 0.25}
                  onChange={e => updateConfig({ risk_per_trade_pct: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Trava Perda Diária ($)</label>
                  <input 
                    type="number"
                    value={config.daily_loss_limit || ''}
                    onChange={e => updateConfig({ daily_loss_limit: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Meta de Lucro ($)</label>
                  <input 
                    type="number"
                    value={config.profit_target || ''}
                    onChange={e => updateConfig({ profit_target: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => updateConfig({ auto_trade: !config.auto_trade })}
                  className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                    config.auto_trade ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                  {config.auto_trade ? 'Robô: AUTO-TRADE ATIVADO' : 'Robô: PAUSADO'}
                </button>
                {config.killswitch && (
                  <button
                    onClick={() => updateConfig({ killswitch: false })}
                    className="px-4 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg text-slate-300">
                    Resetar Trava
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ABA DO CHAT */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col p-4 justify-between overflow-hidden">
              <div className="mb-2">
                <input
                  type="password"
                  value={groqKey}
                  onChange={e => setGroqKey(e.target.value)}
                  placeholder="Chave Groq API (opcional para IA responder em tempo real)"
                  className="w-full bg-slate-950 border border-slate-800 text-xs rounded px-3 py-1.5 text-slate-400 font-mono"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-3">
                {messages.map((m, i) => (
                  <div key={i} className={`p-3 rounded-lg text-sm max-w-[85%] ${
                    m.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}>
                    {m.text}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  value={inputMsg}
                  onChange={e => setInputMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChat()}
                  placeholder="Ex: Alex, mude o risco para 0.2% e foco no Ouro..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button onClick={handleChat} className="bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg text-sm font-bold">
                  Enviar
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}