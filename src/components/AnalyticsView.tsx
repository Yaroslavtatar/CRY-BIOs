/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { AnalyticsSummary } from '../types';
import { Eye, Clock, Laptop, Compass, Globe2 } from 'lucide-react';

interface AnalyticsViewProps {
  analytics: AnalyticsSummary | null;
  onRefresh: () => void;
}

const PIE_COLORS = ['#00f2ff', '#a855f7', '#ec4899', '#3b82f6', '#10b981'];

export default function AnalyticsView({ analytics, onRefresh }: AnalyticsViewProps) {
  if (!analytics) {
    return (
      <div className="bg-[#050505] border border-white/10 rounded-sm p-12 text-center text-neutral-400 font-mono text-xs flex flex-col items-center justify-center space-y-4">
        <Clock className="w-10 h-10 text-neutral-600 animate-spin" />
        <p>Синхронизация данных телеметрии...</p>
      </div>
    );
  }

  const {
    totalViews,
    uniqueViews,
    referrersHistogram,
    devicesHistogram,
    countriesHistogram
  } = analytics;

  // Let's create fallback data if the charts need a clean representation
  const chartData = analytics.visitsOverTime && analytics.visitsOverTime.length > 0 
    ? analytics.visitsOverTime 
    : [
        { date: 'Mon', views: 0 },
        { date: 'Tue', views: 0 },
        { date: 'Wed', views: 0 },
        { date: 'Thu', views: 0 },
        { date: 'Fri', views: 0 },
        { date: 'Sat', views: 0 },
        { date: 'Sun', views: 0 },
      ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Refresh Trigger */}
      <div className="flex justify-between items-center bg-[#0c0c0c] p-4 rounded-sm border border-white/10">
        <div>
          <h3 className="text-sm font-black tracking-widest text-[#00f2ff] uppercase font-mono italic">
            🛰️ Мониторинг телеметрии в реальном времени
          </h3>
          <p className="text-[10px] text-neutral-500 mt-0.5 uppercase font-mono font-bold">
            Логи обновляются моментально при просмотре вашего профиля
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 hover:bg-[#00f2ff] hover:text-black rounded-sm text-[10px] font-black font-mono border border-white/15 hover:border-transparent transition cursor-pointer uppercase"
        >
          [ СИНХРОНИЗИРОВАТЬ ]
        </button>
      </div>

      {/* Numerical Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-black/60 border border-white/10 p-4 rounded-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-neutral-400 font-mono uppercase font-bold">Всего визитов</span>
            <Eye className="w-4 h-4 text-[#00f2ff]" />
          </div>
          <span className="text-2xl font-black font-mono text-white mt-1.5 block">{totalViews}</span>
          <span className="text-[9px] text-neutral-500 font-mono mt-1 block uppercase font-bold">Общие просмотры</span>
        </div>

        <div className="bg-black/60 border border-white/10 p-4 rounded-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-neutral-400 font-mono uppercase font-bold">Уникальные посетители</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-2xl font-black font-mono text-white mt-1.5 block">{uniqueViews}</span>
          <span className="text-[9px] text-neutral-500 font-mono mt-1 block uppercase font-bold">Фильтрация сессий</span>
        </div>

        <div className="bg-black/60 border border-white/10 p-4 rounded-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-neutral-400 font-mono uppercase font-bold">Региональные локации</span>
            <Globe2 className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-black font-mono text-white mt-1.5 block">{countriesHistogram.length || 0}</span>
          <span className="text-[9px] text-neutral-500 font-mono mt-1 block uppercase font-bold">Уникальные страны</span>
        </div>

        <div className="bg-black/60 border border-white/10 p-4 rounded-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-neutral-400 font-mono uppercase font-bold">Основной источник</span>
            <Compass className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-sm font-black font-mono text-[#00f2ff] mt-1.5 block truncate uppercase italic">
            {referrersHistogram[0]?.referrer || 'Прямая ссылка'}
          </span>
          <span className="text-[9px] text-neutral-500 font-mono mt-1 block uppercase font-bold">Топ рефереров</span>
        </div>
      </div>

      {/* Line Chart row (Visits Over Time) */}
      <div className="bg-black/60 border border-white/10 p-5 rounded-sm">
        <h4 className="text-xs font-mono font-black uppercase text-[#00f2ff] mb-4 flex items-center gap-2 italic">
          <Clock className="w-3.5 h-3.5" />
          <span>Посещения за последние 7 дней (Количество просмотров)</span>
        </h4>

        <div className="h-48 w-full font-mono text-[10px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="viewsGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00f2ff" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#4b5563" tickLine={false} />
              <YAxis stroke="#4b5563" tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px' }}
                labelStyle={{ color: '#9ca3af', fontFamily: 'monospace' }}
              />
              <Area type="monotone" dataKey="views" stroke="#00f2ff" strokeWidth={2} fillOpacity={1} fill="url(#viewsGlow)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid for pies & side histories */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Referrers List */}
        <div className="bg-black/60 border border-white/10 p-5 rounded-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-mono font-black uppercase text-[#00f2ff] mb-3 flex items-center gap-2 italic">
              <Compass className="w-3.5 h-3.5" />
              <span>Источники переходов (Рефереры)</span>
            </h4>
            
            {referrersHistogram.length === 0 ? (
              <div className="py-12 text-center font-mono text-[10px] text-neutral-500 uppercase font-bold">
                Ожидание данных о реферерах...
              </div>
            ) : (
              <div className="space-y-2 mt-4 font-mono">
                {referrersHistogram.map((item) => (
                  <div key={item.referrer} className="flex justify-between items-center text-xs p-2 rounded-sm bg-white/[0.02] border border-white/5 hover:border-white/10 transition">
                    <span className="text-neutral-300 font-bold">{item.referrer}</span>
                    <span className="text-[#00f2ff] font-black">{item.count} визитов</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Device breakdown Pie Chart */}
        <div className="bg-black/60 border border-white/10 p-5 rounded-sm">
          <h4 className="text-xs font-mono font-black uppercase text-[#00f2ff] mb-3 flex items-center gap-2 italic">
            <Laptop className="w-3.5 h-3.5" />
            <span>Устройства посетителей</span>
          </h4>

          {devicesHistogram.length === 0 ? (
            <div className="py-12 text-center font-mono text-[10px] text-neutral-500 uppercase font-bold">
              Нет истории об устройствах
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-around mt-4">
              <div className="h-32 w-32 font-mono text-[9px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={devicesHistogram}
                      dataKey="count"
                      nameKey="device"
                      cx="50%"
                      cy="50%"
                      outerRadius={45}
                      fill="#8884d8"
                    >
                      {devicesHistogram.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0c0c0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 font-mono mt-4 sm:mt-0">
                {devicesHistogram.map((item, idx) => (
                  <div key={item.device} className="flex items-center space-x-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span className="text-neutral-400 font-bold">{item.device === 'desktop' ? '💻 Десктоп' : item.device === 'mobile' ? '📱 Смартфон' : '🌐 Другое'}:</span>
                    <span className="font-black text-white">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row for Countries */}
      <div className="bg-black/60 border border-white/10 p-5 rounded-sm">
        <h4 className="text-xs font-mono font-black uppercase text-[#00f2ff] mb-4 flex items-center gap-2 italic">
          <Globe2 className="w-3.5 h-3.5" />
          <span>Региональное распределение (по языку браузера Accept-Language)</span>
        </h4>

        {countriesHistogram.length === 0 ? (
          <div className="py-8 text-center font-mono text-[10px] text-neutral-500 uppercase font-bold">
            Ожидание логов о регионах посетителей...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
            {countriesHistogram.map((item) => (
              <div key={item.country} className="p-3 bg-black/40 border border-white/10 rounded-sm flex items-center justify-between font-mono">
                <div>
                  <span className="text-neutral-500 text-[9px] block uppercase font-bold">Язык</span>
                  <span className="text-white font-bold text-xs tracking-wider uppercase">{item.country}</span>
                </div>
                <div className="text-right">
                  <span className="text-neutral-500 text-[9px] block uppercase font-bold">Хиты</span>
                  <span className="text-[#00f2ff] font-mono text-xs font-black">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
