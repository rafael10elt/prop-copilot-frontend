import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShieldAlert, TrendingUp, Cpu, Sliders, MessageSquare, PlayCircle, XCircle } from 'lucide-react';

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
    killswitch: false,
    rr_mode: 'manual',
    target_rr: 1.5,
    enable_be: false
  });

  const [telemetry, setTelemetry] = useState({ equity: 100000, balance: 100000, daily_pnl: 0, current_spread: 1.2, ai_status: 'Carregando...' });
  const [position, setPosition] = useState({ has_position: false });
  const [metrics, setMetrics] = useState({ total_trades: 0, wins: 0, losses: 0, be_count: 0, win_rate: 0, net_profit_r: 0, net_profit_usd: 0 });
  const [activeTab, setActiveTab] = useState('form');

  useEffect(() => {
    supabase.from('prop_config').select('*').eq('id', 1).single().then(r => r.data && setConfig(r.data));
    supabase.from('bot_telemetry').select('*').eq('id', 1).single().then(r => r.data && setTelemetry(r.data));
    supabase.from('active_position').select('*').eq('id', 1).single().then(r => r.data && setPosition(r.data));
    supabase.from('session_metrics').select('*').eq('id', 1).single().then(r => r.data && setMetrics(r.data));

    const channel = supabase.channel('desk_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prop_config' }, p => setConfig(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bot_telemetry' }, p => setTelemetry(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'active_position' }, p => setPosition(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'session_metrics' }, p => setMetrics(p.new))
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const updateConfig = async (fields) => {
    setConfig(prev => ({ ...prev, ...fields }));
    await supabase.from('prop_config').update(fields).eq('id', 1);
  };

  const closeActiveTrade = async () => {
    await updateConfig({ killswitch: true });
    setTimeout(() => updateConfig({ killswitch: false }), 2000);
  };

  const isProfit = (metrics.net_profit_usd || 0) >= 0;

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6 text-slate-100">
      {/* Top Header */}
      <header className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 mb-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
            <Cpu size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-wide">{config.prop_name} Copilot</h1>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                {config.active_symbol} • {config.timeframe}
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

      {/* Grid Superior: Métricas do Pregão (Inspirado no seu Print) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        
        {/* CARD INSPIRADO NO SEU PRINT */}
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

          {/* DESTAQUE DE LUCRO LÍQUIDO */}
          <div className={`text-xl md:text-2xl font-black ${isProfit ? 'text-[#00ff66]' : 'text-rose-500'}`}>
            LUCRO LÍQUIDO: {isProfit ? '+' : ''}{metrics.net_profit_r} R ({isProfit ? '+$' : '-$'}{Math.abs(metrics.net_profit_usd || 0).toFixed(2)})
          </div>
        </div>

        {/* CARD: STATUS DO ROBÔ */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Diagnóstico da IA</span>
            <p className="text-sm font-semibold text-blue-400">{telemetry.ai_status}</p>
          </div>
          <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Spread:</span>
            <span className="font-mono text-slate-200">{telemetry.current_spread} pips</span>
          </div>
        </div>

      </div>

      {/* Grid Inferior: Operação Aberta & Painel de Controle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* OPERAÇÃO ABERTA EM TEMPO REAL */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <PlayCircle size={16} className="text-blue-400" /> Operação Aberta (Única)
              </h3>
              {position.has_position && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded animate-pulse">
                  AO VIVO
                </span>
              )}
            </div>

            {position.has_position ? (
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Ativo / Tipo:</span>
                  <span className={`font-bold ${position.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {position.symbol} • {position.type} ({position.lots} lotes)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Entrada:</span>
                  <span>{position.open_price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Preço Atual:</span>
                  <span className="text-white font-bold">{position.current_price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Stop Loss / TP:</span>
                  <span className="text-slate-300">{position.sl} / {position.tp}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 text-sm">
                  <span className="text-slate-400">PnL Flutuante:</span>
                  <span className={`font-black ${position.pnl_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {position.pnl_usd >= 0 ? '+$' : '-$'}{Math.abs(position.pnl_usd).toFixed(2)} ({position.pnl_r} R)
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                Nenhuma operação aberta no momento.<br />Aguardando gatilho do robô.
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

        {/* CONFIGURAÇÃO RÁPIDA: ALVO, RISCO E BREAK-EVEN */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4 text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Sliders size={16} className="text-blue-400" /> Parâmetros da Estratégia
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* MODO DE ALVO (IA vs MANUAL) */}
            <div>
              <label className="text-slate-400 block mb-1">Modo de Alvo (R:R)</label>
              <select
                value={config.rr_mode}
                onChange={e => updateConfig({ rr_mode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white">
                <option value="manual">Manual (Fixo)</option>
                <option value="ai">IA Adaptativa (Cenário SMC)</option>
              </select>
            </div>

            {/* PROPORÇÃO R:R */}
            <div>
              <label className="text-slate-400 block mb-1">Relação Risco:Retorno</label>
              <select
                disabled={config.rr_mode === 'ai'}
                value={config.target_rr}
                onChange={e => updateConfig({ target_rr: parseFloat(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white disabled:opacity-40">
                <option value="1.0">1:1.0</option>
                <option value="1.5">1:1.5 (Padrão)</option>
                <option value="2.0">1:2.0</option>
                <option value="3.0">1:3.0</option>
              </select>
            </div>

            {/* BREAK-EVEN TOGGLE */}
            <div>
              <label className="text-slate-400 block mb-1">Auto Break-Even (Zero a Zero)</label>
              <button
                onClick={() => updateConfig({ enable_be: !config.enable_be })}
                className={`w-full py-2.5 rounded-lg font-bold transition-all ${
                  config.enable_be ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                {config.enable_be ? 'BE ATIVADO (1:1)' : 'BE DESATIVADO'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="text-slate-400 block mb-1">Ativo</label>
              <select
                value={config.active_symbol}
                onChange={e => updateConfig({ active_symbol: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white">
                <option value="XAUUSD">XAUUSD (Ouro)</option>
                <option value="US30">US30 (Dow Jones)</option>
                <option value="EURUSD">EURUSD</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Risco por Trade: {config.risk_per_trade_pct}%</label>
              <input
                type="range" min="0.1" max="1.0" step="0.05"
                value={config.risk_per_trade_pct || 0.25}
                onChange={e => updateConfig({ risk_per_trade_pct: parseFloat(e.target.value) })}
                className="w-full mt-2 accent-blue-500"
              />
            </div>
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
    </div>
  );
}