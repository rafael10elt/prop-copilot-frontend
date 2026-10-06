import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShieldAlert, Cpu, Sliders, PlayCircle, XCircle, Zap, ArrowUpRight, ArrowDownRight, MessageSquare, X, Send, Bot } from 'lucide-react';

const SUPABASE_URL = "https://wvyllpbqtahxrqsjjzgp.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2eWxscGJxdGFoeHJxc2pqemdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzU3NzEsImV4cCI6MjEwNjgxMTc3MX0.7qIsu2oZermD9uPA8ggSfNZuKDZH-_ifs2jJjeTX6XM";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// Chave Gemini fornecida (pode ser editada na tela se desejar)
const DEFAULT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

export default function App() {
  const [config, setConfig] = useState({
    prop_name: 'Prop Trader',
    account_size: 100000,
    daily_loss_limit: 5000,
    profit_target: 10000,
    active_symbol: 'XAUUSD',
    strategy_mode: 'ai_auto',
    timeframe_mode: 'manual',
    timeframe: 'M5',
    risk_per_trade_pct: 0.25,
    auto_trade: true,
    killswitch: false,
    rr_mode: 'manual',
    target_rr: 1.5,
    enable_be: false
  });

  const [telemetry, setTelemetry] = useState({ equity: 100000, balance: 100000, daily_pnl: 0, current_spread: 0, ai_status: 'Carregando...' });
  const [position, setPosition] = useState({ has_position: false });
  const [metrics, setMetrics] = useState({ total_trades: 0, wins: 0, losses: 0, be_count: 0, win_rate: 0, net_profit_r: 0, net_profit_usd: 0 });

  // Estado do Chat Money Maker
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState(DEFAULT_GEMINI_KEY);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'E aí, chefe! Sou o Money Maker, seu funcionário trader. Estou vigiando o gráfico e protegendo o capital da mesa. O que manda?' }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    supabase.from('prop_config').select('*').eq('id', 1).single().then(r => r.data && setConfig(r.data));
    supabase.from('bot_telemetry').select('*').eq('id', 1).single().then(r => r.data && setTelemetry(r.data));
    supabase.from('active_position').select('*').eq('id', 1).single().then(r => r.data && setPosition(r.data));
    supabase.from('session_metrics').select('*').eq('id', 1).single().then(r => r.data && setMetrics(r.data));

    const channel = supabase.channel('desk_updates_v5')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prop_config' }, p => setConfig(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bot_telemetry' }, p => setTelemetry(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'active_position' }, p => setPosition(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'session_metrics' }, p => setMetrics(p.new))
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (isChatOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const updateConfig = async (fields) => {
    setConfig(prev => ({ ...prev, ...fields }));
    await supabase.from('prop_config').update(fields).eq('id', 1);
  };

  const closeActiveTrade = async () => {
    await updateConfig({ killswitch: true });
    setTimeout(() => updateConfig({ killswitch: false }), 2000);
  };

  const isProfit = (metrics.net_profit_usd || 0) >= 0;

  const getStrategyLabel = (mode) => {
    switch (mode) {
      case 'fvg': return 'FVG (Fair Value Gap)';
      case 'smc': return 'SMC (Liquidity Sweep)';
      case 'price_action': return 'Price Action';
      case 'trend_vwap': return 'Trend Pullback';
      default: return '🤖 IA Auto-Select';
    }
  };

  const calculateTradeProgress = () => {
    if (!position.has_position || !position.sl || !position.tp || position.sl === position.tp) return 50;
    const totalSpan = Math.abs(position.tp - position.sl);
    if (totalSpan === 0) return 50;
    const currentDist = position.type === 'BUY' 
      ? position.current_price - position.sl 
      : position.sl - position.current_price;
    const pct = (currentDist / totalSpan) * 100;
    return Math.max(5, Math.min(95, pct));
  };

  // Conversa com o Money Maker via Google Gemini API
  const handleSendMessage = async () => {
    if (!inputMsg.trim() || isThinking) return;
    const userText = inputMsg;
    setInputMsg('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsThinking(true);

    // Contexto Institucional ao Vivo injetado no prompt
    const systemPrompt = `
Você é o "Money Maker", um funcionário trader institucional de elite, especialista em scalping e aprovação de contas de mesa proprietária.
Você é direto, técnico, confiante, divertido e extremamente focado em proteção de capital.

ESTADO DA CONTA AGORA:
- Mesa: ${config.prop_name}
- Saldo: $${telemetry.balance} | Equity: $${telemetry.equity}
- Trava Diária: -$${config.daily_loss_limit} | PnL do Dia: $${telemetry.daily_pnl}
- Risco por Trade: ${config.risk_per_trade_pct}%
- Ativo Monitorado: ${config.active_symbol} (${config.timeframe})
- Estratégia Ativa: ${getStrategyLabel(config.strategy_mode)}
- Diagnóstico do Mercado: ${telemetry.ai_status}

MÉTRICAS DO PREGÃO HOJE:
- Total Trades: ${metrics.total_trades} | Acerto: ${metrics.win_rate}%
- Wins: ${metrics.wins} | Losses: ${metrics.losses} | BE: ${metrics.be_count}
- Lucro Líquido: ${metrics.net_profit_r} R ($${metrics.net_profit_usd})

OPERAÇÃO ABERTA NO MOMENTO:
${position.has_position ? `
- ATIVA: ${position.type} no ${position.symbol} (${position.lots} lotes)
- Ponto de Entrada: ${position.open_price} | Preço Atual: ${position.current_price}
- Stop Loss: ${position.sl} | Take Profit: ${position.tp}
- PnL Flutuante: $${position.pnl_usd} (${position.pnl_r} R)
- Motivo da Entrada: ${telemetry.ai_status}
` : '- NENHUMA operação aberta no momento. Aguardando novo setup institucional.'}

INSTRUÇÕES DE RESPOSTA:
1. Responda em português com tom profissional de trader pro.
2. Se o usuário perguntar sobre o dia ou trades, faça um resumo detalhado usando os dados acima.
3. Se o usuário perguntar sobre a operação aberta, explique o motivo da entrada e a situação do SL/TP/PnL.
4. Se o usuário pedir para alterar algum parâmetro operacional (ex: mudar risco, ativo, timeframe), confirme a alteração e finalize OBRIGATORIAMENTE incluindo um bloco JSON com as propriedades alteradas, por exemplo: {"risk_per_trade_pct": 0.5, "active_symbol": "US30"}.
`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey.trim()}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${systemPrompt}\n\nMENSAGEM DO USUÁRIO: ${userText}` }]
            }
          ]
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, tive um lapso momentâneo na conexão com o mercado.";

      // Se a IA ordenou mudança de parâmetros via JSON
      if (reply.includes('{') && reply.includes('}')) {
        const jsonMatch = reply.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            await updateConfig(parsed);
          } catch (e) {
            console.error("Erro ao aplicar comando do Money Maker:", e);
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', text: reply.replace(/\{[\s\S]*?\}/g, '').trim() }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: `⚠️ Erro de conexão com a API do Gemini: ${err.message}. Verifique a chave configurada no topo do chat.` 
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6 text-slate-100 font-sans relative">
      {/* Header */}
      <header className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 mb-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
            <Cpu size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-wide">{config.prop_name || 'Prop'} Copilot</h1>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                {config.active_symbol} • {config.timeframe_mode === 'ai_dynamic' ? 'IA Multi-TF' : config.timeframe}
              </span>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                <Zap size={10} /> {getStrategyLabel(config.strategy_mode)}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Equity: <strong className="text-white">${telemetry.equity?.toLocaleString()}</strong> | Saldo: ${telemetry.balance?.toLocaleString()}
            </p>
          </div>
        </div>

        <button
          onClick={() => updateConfig({ killswitch: true, auto_trade: false })}
          className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-950/50">
          <ShieldAlert size={18} /> EMERGENCY KILLSWITCH
        </button>
      </header>

      {/* Grid Superior: Métricas do Pregão */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <div className="md:col-span-2 bg-[#0a0f1d] border border-slate-800 rounded-xl p-5 shadow-xl font-mono">
          <div className="flex justify-between items-center text-xs md:text-sm text-amber-400 font-bold border-b border-slate-800 pb-2 mb-3">
            <span>Alvo: {config.rr_mode === 'ai' ? 'IA (Cenário)' : `1:${config.target_rr}`}</span>
            <span>Risco: {config.risk_per_trade_pct}%</span>
            <span>BE: {config.enable_be ? 'ON' : 'OFF'}</span>
          </div>

          <p className="text-center text-xs tracking-widest text-slate-500 mb-2 font-sans font-semibold">
            ——— MÉTRICAS DO PREGÃO ———
          </p>

          <div className="flex justify-between items-center text-xs text-emerald-400 mb-1">
            <span>Trades: {metrics.total_trades}</span>
            <span>Acerto: {metrics.win_rate}%</span>
          </div>

          <div className="flex gap-4 text-xs text-emerald-500/90 mb-3">
            <span>W: {metrics.wins}</span>
            <span>L: {metrics.losses}</span>
            <span>BE: {metrics.be_count}</span>
          </div>

          <div className={`text-xl md:text-2xl font-black ${isProfit ? 'text-[#00ff66]' : 'text-rose-500'}`}>
            LUCRO LÍQUIDO: {isProfit ? '+' : ''}{metrics.net_profit_r} R ({isProfit ? '+$' : '-$'}{Math.abs(metrics.net_profit_usd || 0).toFixed(2)})
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Diagnóstico da IA</span>
            <p className="text-sm font-semibold text-blue-400">{telemetry.ai_status}</p>
          </div>
          <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">Spread Atual:</span>
            <span className="text-slate-200">{telemetry.current_spread} pips</span>
          </div>
        </div>
      </div>

      {/* Grid Inferior: Operação Aberta & Configurações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* OPERAÇÃO ABERTA */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <PlayCircle size={16} className="text-blue-400" /> Operação Aberta
              </h3>
              {position.has_position && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold animate-pulse">
                  AO VIVO • #{position.ticket}
                </span>
              )}
            </div>

            {position.has_position ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono flex items-center gap-1 ${
                      position.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {position.type === 'BUY' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {position.type}
                    </span>
                    <span className="font-bold text-white text-sm">{position.symbol}</span>
                  </div>
                  <span className="font-mono text-xs text-slate-400">{position.lots} lotes</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="bg-rose-950/30 border border-rose-900/50 p-2 rounded-lg">
                    <span className="text-[10px] text-rose-400 font-sans block font-semibold">STOP LOSS</span>
                    <strong className="text-xs text-rose-200">{position.sl || '---'}</strong>
                    <span className="text-[9px] text-rose-400 block mt-0.5 font-sans">-1.0 R</span>
                  </div>

                  <div className="bg-blue-950/30 border border-blue-900/50 p-2 rounded-lg">
                    <span className="text-[10px] text-blue-400 font-sans block font-semibold">ENTRADA</span>
                    <strong className="text-xs text-blue-200">{position.open_price}</strong>
                    <span className="text-[9px] text-slate-400 block mt-0.5 font-sans">Execução</span>
                  </div>

                  <div className="bg-emerald-950/30 border border-emerald-900/50 p-2 rounded-lg">
                    <span className="text-[10px] text-emerald-400 font-sans block font-semibold">TAKE PROFIT</span>
                    <strong className="text-xs text-emerald-200">{position.tp || '---'}</strong>
                    <span className="text-[9px] text-emerald-400 block mt-0.5 font-sans">+{config.target_rr} R</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1.5">
                    <span className="text-rose-400">SL</span>
                    <span className="text-white font-bold">Atual: {position.current_price}</span>
                    <span className="text-emerald-400">TP</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full relative overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-700 ${position.pnl_usd >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${calculateTradeProgress()}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <span className="text-xs text-slate-400 font-sans">PnL Flutuante:</span>
                  <div className="text-right">
                    <span className={`text-base font-black font-mono ${position.pnl_usd >= 0 ? 'text-[#00ff66]' : 'text-rose-500'}`}>
                      {position.pnl_usd >= 0 ? '+$' : '-$'}{Math.abs(position.pnl_usd).toFixed(2)}
                    </span>
                    <span className="text-xs font-mono text-slate-400 ml-1.5">({position.pnl_r} R)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs font-sans">
                Nenhuma operação aberta no momento.<br />Aguardando gatilho institucional no gráfico.
              </div>
            )}
          </div>

          {position.has_position && (
            <button
              onClick={closeActiveTrade}
              className="w-full mt-4 py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5">
              <XCircle size={14} /> Fechar Operação a Mercado
            </button>
          )}
        </div>

        {/* PARÂMETROS OPERACIONAIS */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4 text-xs font-sans">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Sliders size={16} className="text-blue-400" /> Estratégia e Parâmetros
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 block mb-1">Estratégia</label>
              <select
                value={config.strategy_mode || 'ai_auto'}
                onChange={e => updateConfig({ strategy_mode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-blue-400 font-bold focus:border-blue-500">
                <option value="ai_auto">🤖 IA Auto-Select (Adaptativo)</option>
                <option value="fvg">⚡ FVG (Fair Value Gap)</option>
                <option value="smc">🎯 SMC (Liquidity Sweep)</option>
                <option value="price_action">🕯️ Price Action (Rejeição)</option>
                <option value="trend_vwap">📈 Trend Pullback</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Ativo de Foco</label>
              <select
                value={config.active_symbol}
                onChange={e => updateConfig({ active_symbol: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-semibold">
                <option value="XAUUSD">XAUUSD (Ouro)</option>
                <option value="USOIL">USOIL / WTI (Petróleo)</option>
                <option value="NAS100">NAS100 (Nasdaq)</option>
                <option value="US30">US30 (Dow Jones)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="text-slate-400 block mb-1">Timeframe</label>
              <select
                value={config.timeframe_mode === 'ai_dynamic' ? 'ai' : config.timeframe}
                onChange={e => {
                  if (e.target.value === 'ai') {
                    updateConfig({ timeframe_mode: 'ai_dynamic' });
                  } else {
                    updateConfig({ timeframe_mode: 'manual', timeframe: e.target.value });
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white">
                <option value="ai">🤖 IA Dinâmica (M15->M5)</option>
                <option value="M1">Manual: M1</option>
                <option value="M5">Manual: M5</option>
                <option value="M15">Manual: M15</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Relação R:R</label>
              <select
                value={config.target_rr}
                onChange={e => updateConfig({ target_rr: parseFloat(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white">
                <option value="1.0">1:1.0</option>
                <option value="1.5">1:1.5 (Padrão)</option>
                <option value="2.0">1:2.0</option>
                <option value="3.0">1:3.0</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Auto Break-Even</label>
              <button
                onClick={() => updateConfig({ enable_be: !config.enable_be })}
                className={`w-full py-2 rounded-lg font-bold transition-all ${
                  config.enable_be ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                {config.enable_be ? 'BE ATIVADO (1:1)' : 'BE DESATIVADO'}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <div className="flex justify-between mb-1">
              <span className="text-slate-400">Risco por Trade:</span>
              <span className="font-bold text-blue-400 font-mono">{config.risk_per_trade_pct}%</span>
            </div>
            <input
              type="range" min="0.1" max="1.0" step="0.05"
              value={config.risk_per_trade_pct || 0.25}
              onChange={e => updateConfig({ risk_per_trade_pct: parseFloat(e.target.value) })}
              className="w-full accent-blue-500"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => updateConfig({ auto_trade: !config.auto_trade })}
              className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
                config.auto_trade ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
              {config.auto_trade ? 'Robô: AUTO-TRADE ATIVADO (1 OP POR VEZ)' : 'Robô: PAUSADO'}
            </button>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 🤖 ASSISTENTE FLUTUANTE: MONEY MAKER                    */}
      {/* ======================================================== */}
      
      {/* Botão Flutuante (Canto Inferior Direito) */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white p-3.5 rounded-full shadow-2xl shadow-blue-500/30 flex items-center gap-2.5 transition-all transform hover:scale-105 z-50">
          <Bot size={22} />
          <span className="font-bold text-xs pr-1">Money Maker</span>
          <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
        </button>
      )}

      {/* Janela do Chat (Drawer Flutuante) */}
      {isChatOpen && (
        <div className="fixed bottom-6 right-6 w-96 max-w-[90vw] h-[540px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden font-sans">
          
          {/* Topo do Chat */}
          <div className="bg-slate-950 p-3.5 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <Bot size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  Money Maker <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                </h4>
                <p className="text-[10px] text-slate-400">Copiloto IA • Gemini Flash</p>
              </div>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all">
              <X size={18} />
            </button>
          </div>

          {/* Campo da Chave Gemini (Editável com valor padrão preenchido) */}
          <div className="px-3 py-1.5 bg-slate-950/70 border-b border-slate-800 flex items-center gap-2">
            <span className="text-[9px] text-slate-400 font-mono">KEY:</span>
            <input 
              type="password"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="Cole sua Gemini API Key..."
              className="w-full bg-transparent text-[10px] text-slate-300 font-mono focus:outline-none"
            />
          </div>

          {/* Histórico de Mensagens */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs">
            {messages.map((m, i) => (
              <div key={i} className={`p-3 rounded-xl max-w-[85%] leading-relaxed ${
                m.role === 'user' 
                  ? 'ml-auto bg-blue-600 text-white font-medium shadow-md' 
                  : 'bg-slate-800 text-slate-200 border border-slate-700/60'
              }`}>
                {m.text}
              </div>
            ))}
            {isThinking && (
              <div className="p-2.5 rounded-xl bg-slate-800 text-slate-400 text-xs w-28 flex items-center gap-1.5 animate-pulse">
                <Bot size={14} /> Analisando...
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input de Envio */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
            <input
              value={inputMsg}
              onChange={e => setInputMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Pergunte sobre a operação, dia, ou ordene mudanças..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={isThinking}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all">
              <Send size={14} />
            </button>
          </div>

        </div>
      )}

    </div>
  );
}