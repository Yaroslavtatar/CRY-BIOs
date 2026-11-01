import React, { useState } from 'react';
import { Star, GitFork, CircleDot, Scale, Tag, Clock, GitPullRequest, Bug, Lightbulb, Heart, Copy, Check } from 'lucide-react';
import SocialIcon from '../SocialIcon';
import { DEFAULT_REPO } from '../../github';
import type { GithubState } from '../../hooks/useGithub';
import { compactNumber, relativeTime, isVersionTag } from '../../utils/format';

const EXT = { target: '_blank', rel: 'noopener noreferrer' } as const;

function Stat({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      {...EXT}
      className="flex-1 min-w-[80px] bg-black/50 border border-white/10 hover:border-[#00f2ff]/40 rounded-sm px-4 py-3 transition group"
      title={label}
    >
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-neutral-500 font-bold group-hover:text-[#00f2ff] transition">
        {icon}
        {label}
      </span>
      <span className="block text-2xl font-black tracking-tighter text-white mt-1 tabular-nums">{value}</span>
    </a>
  );
}

/** Аватар контрибьютора; если картинка не загрузилась (блокировщик, оффлайн) — кружок с инициалами, а не alt-текст */
function Avatar({ login, src }: { login: string; src: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs font-black uppercase group-hover:border-[#00f2ff] transition">
        {login.slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={login}
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-10 h-10 rounded-full border border-white/10 group-hover:border-[#00f2ff] transition"
    />
  );
}

function CloneLine({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const cmd = `git clone ${url}.git`;
  return (
    <div className="mt-auto min-w-0">
      <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-black mb-2">Попробовать локально</p>
      <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-sm pl-3 pr-1 py-1">
        <code className="flex-1 min-w-0 truncate text-[11px] text-[#00f2ff] font-mono">{cmd}</code>
        <button
          type="button"
          aria-label="Скопировать команду"
          onClick={() => {
            navigator.clipboard?.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
          }}
          className="p-2 text-neutral-400 hover:text-[#00f2ff] transition cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid lg:grid-cols-5 gap-6 animate-pulse" aria-busy="true" aria-label="Загружаем данные GitHub">
      <div className="lg:col-span-3 h-72 bg-white/5 border border-white/10 rounded-sm" />
      <div className="lg:col-span-2 h-72 bg-white/5 border border-white/10 rounded-sm" />
    </div>
  );
}

/**
 * Блок «Открытый код»: живые данные из GitHub (через наш сервер) + способы помочь проекту.
 * Если GitHub недоступен, остаются рабочие ссылки на репозиторий — без выдуманных цифр.
 */
export default function OpenSourceSection({ github }: { github: GithubState }) {
  const ready = github.status === 'ready';
  const data = ready ? github.data : null;
  const repoUrl = data?.repo.url ?? `https://github.com/${DEFAULT_REPO}`;
  const repoName = data?.repo.fullName ?? DEFAULT_REPO;

  const actions: { href: string; label: string; icon: React.ReactNode; primary?: boolean }[] = [
    { href: repoUrl, label: 'Поставить звезду', icon: <Star className="w-4 h-4" />, primary: true },
    { href: `${repoUrl}/fork`, label: 'Форкнуть', icon: <GitFork className="w-4 h-4" /> },
    { href: `${repoUrl}/issues/new?template=bug_report.md`, label: 'Нашли баг?', icon: <Bug className="w-4 h-4" /> },
    { href: `${repoUrl}/issues/new?template=feature_request.md`, label: 'Предложить идею', icon: <Lightbulb className="w-4 h-4" /> },
  ];

  return (
    <section id="opensource" className="px-6 py-20 max-w-7xl mx-auto">
      <div className="mb-12">
        <div className="inline-block px-3 py-1 bg-white/10 border border-white/20 text-[10px] font-bold uppercase tracking-[0.2em] w-fit mb-4 font-mono">
          Open Source · {data?.repo.license || 'MIT'}
        </div>
        <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-white mb-3">Код открыт — присоединяйтесь</h2>
        <p className="text-neutral-400 text-sm max-w-2xl font-sans leading-relaxed">
          CRY BIOS развивается в открытом репозитории. Читайте код, задавайте вопросы, присылайте исправления и новые функции.
          Всё, что вы видите на этой странице, берётся из GitHub в реальном времени.
        </p>
      </div>

      {github.status === 'loading' ? (
        <Skeleton />
      ) : (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Репозиторий */}
          <div className="lg:col-span-3 min-w-0 bg-[#0c0c0c] border border-white/10 rounded-sm p-5 sm:p-8 flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <SocialIcon platform="github" className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0">
                <a href={repoUrl} {...EXT} className="font-mono font-black text-base sm:text-xl text-white hover:text-[#00f2ff] transition [overflow-wrap:anywhere]">
                  {repoName}
                </a>
                {data?.repo.description && <p className="text-neutral-400 text-sm mt-1 font-sans">{data.repo.description}</p>}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-neutral-500 font-mono">
                  {data?.repo.license && (
                    <span className="inline-flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5" /> {data.repo.license}
                    </span>
                  )}
                  {data?.latestRelease && isVersionTag(data.latestRelease.tag) && (
                    <a href={data.latestRelease.url} {...EXT} className="inline-flex items-center gap-1 hover:text-[#00f2ff] transition">
                      <Tag className="w-3.5 h-3.5" /> {data.latestRelease.tag}
                    </a>
                  )}
                  {data?.repo.pushedAt && (
                    <span className="inline-flex items-center gap-1" title={new Date(data.repo.pushedAt).toLocaleString('ru-RU')}>
                      <Clock className="w-3.5 h-3.5" /> обновлено {relativeTime(data.repo.pushedAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {data ? (
              <div className="flex flex-wrap gap-3">
                <Stat icon={<Star className="w-3.5 h-3.5" />} label="Звёзды" value={compactNumber(data.repo.stars)} href={`${repoUrl}/stargazers`} />
                <Stat icon={<GitFork className="w-3.5 h-3.5" />} label="Форки" value={compactNumber(data.repo.forks)} href={`${repoUrl}/forks`} />
                <Stat icon={<CircleDot className="w-3.5 h-3.5" />} label="Issues" value={compactNumber(data.repo.openIssues)} href={`${repoUrl}/issues`} />
              </div>
            ) : (
              <p className="text-xs text-neutral-500 font-sans">Данные GitHub сейчас недоступны, но репозиторий открыт по ссылке выше.</p>
            )}

            <div className="flex flex-wrap gap-3 font-mono">
              {actions.map((a) => (
                <a
                  key={a.label}
                  href={a.href}
                  {...EXT}
                  className={`px-4 py-2.5 rounded-sm text-[11px] font-black tracking-widest uppercase inline-flex items-center gap-2 transition ${
                    a.primary ? 'bg-[#00f2ff] text-black hover:bg-[#00d0e0]' : 'bg-white/5 border border-white/10 text-white hover:border-[#00f2ff]/50'
                  }`}
                >
                  {a.icon}
                  {a.label}
                </a>
              ))}
            </div>

            <CloneLine url={repoUrl} />

            {github.status === 'ready' && github.stale && (
              <p className="text-[10px] text-amber-300/80 font-sans">GitHub не ответил, показываем последние сохранённые данные.</p>
            )}
          </div>

          {/* Контрибьюторы и изменения */}
          <div className="lg:col-span-2 min-w-0 flex flex-col gap-6">
            {data && data.contributors.length > 0 && (
              <div className="bg-[#0c0c0c] border border-white/10 rounded-sm p-6">
                <h3 className="text-[10px] uppercase tracking-widest text-neutral-500 font-black mb-4 flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-[#00f2ff]" /> Участники проекта
                </h3>
                <ul className="flex flex-wrap gap-2" aria-label="Контрибьюторы">
                  {data.contributors.map((c) => (
                    <li key={c.login}>
                      <a href={c.url} {...EXT} title={`${c.login} · коммитов: ${c.contributions}`} className="block group">
                        <Avatar login={c.login} src={c.avatarUrl} />
                      </a>
                    </li>
                  ))}
                  <li>
                    <a
                      href={`${repoUrl}/blob/${data.repo.defaultBranch}/README.md`}
                      {...EXT}
                      title="Как присоединиться"
                      className="w-10 h-10 rounded-full border border-dashed border-white/20 hover:border-[#00f2ff] text-neutral-500 hover:text-[#00f2ff] flex items-center justify-center text-lg transition"
                    >
                      +
                    </a>
                  </li>
                </ul>
              </div>
            )}

            {data && data.recentCommits.length > 0 && (
              <div className="bg-[#0c0c0c] border border-white/10 rounded-sm p-6 flex-1">
                <h3 className="text-[10px] uppercase tracking-widest text-neutral-500 font-black mb-4 flex items-center gap-2">
                  <GitPullRequest className="w-3.5 h-3.5 text-[#00f2ff]" /> Последние изменения
                </h3>
                <ul className="space-y-3">
                  {data.recentCommits.map((c) => (
                    <li key={c.sha}>
                      <a href={c.url} {...EXT} className="block group">
                        <span className="block text-xs text-neutral-200 group-hover:text-[#00f2ff] transition font-sans line-clamp-2 break-words">{c.message}</span>
                        <span className="block text-[10px] text-neutral-600 font-mono mt-0.5">
                          {c.sha}
                          {c.author && ` · ${c.author}`}
                          {c.date && ` · ${relativeTime(c.date)}`}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
