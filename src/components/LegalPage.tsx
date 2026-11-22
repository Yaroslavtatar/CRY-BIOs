import type { ReactNode } from 'react';
import {
  formatLegalDate,
  formatOperator,
  requisitesLines,
  splitParagraphs,
  type LegalSettings,
} from '../legalConfig';
import { useLegal } from '../hooks/useLegal';

type Doc = 'privacy' | 'terms';

const TITLES: Record<Doc, string> = {
  privacy: 'Политика конфиденциальности',
  terms: 'Условия использования',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="space-y-2 text-neutral-300 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Extra({ text }: { text: string }) {
  const paragraphs = splitParagraphs(text);
  if (!paragraphs.length) return null;
  return (
    <Section title="Дополнительные положения">
      {paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
    </Section>
  );
}

function OperatorInfo({ legal }: { legal: LegalSettings }) {
  const lines = requisitesLines(legal);
  return (
    <>
      <p>Оператор сервиса: {formatOperator(legal)}. Связь по вопросам данных: {legal.operatorContact}.</p>
      {lines.length > 0 && <p>Реквизиты: {lines.join(', ')}.</p>}
      {legal.abuseContact && <p>Жалобы на контент и нарушения: {legal.abuseContact}.</p>}
    </>
  );
}

function Privacy({ legal }: { legal: LegalSettings }) {
  return (
    <>
      <Section title="1. Кто обрабатывает данные">
        <OperatorInfo legal={legal} />
      </Section>
      <Section title="2. Какие данные мы храним">
        <ul className="list-disc pl-5 space-y-1">
          <li>Аккаунт: имя пользователя и пароль в виде хэша (сам пароль не хранится).</li>
          <li>Профиль: всё, что вы сами добавляете на страницу (имя, описание, ссылки, картинки, музыка, блоки).</li>
          <li>Двухфакторная аутентификация, если вы её включили: зашифрованный секрет и хэши резервных кодов.</li>
          <li>Статистика просмотров вашей страницы: время визита, источник перехода (referrer), тип устройства, браузер, страна и адрес сайта. IP-адрес посетителя и cookie в статистике не сохраняются.</li>
          <li>Подключение Discord, если вы его включили: публичные данные вашего Discord-профиля.</li>
        </ul>
      </Section>
      <Section title="3. Cookie и локальное хранилище">
        <p>Сервис использует одну служебную cookie сессии (HttpOnly). Она создаётся только при входе в аккаунт и нужна для работы личного кабинета. Посетители публичных страниц cookie от нашего сайта не получают.</p>
        <p>В localStorage браузера хранятся только настройки интерфейса: имя пользователя для входа, параметры кабинета, отметка пройденного обучения и громкость плеера. Аналитические и рекламные трекеры не используются.</p>
      </Section>
      <Section title="4. Сторонние сервисы">
        <p>Если владелец страницы встроил видео или плеер (YouTube, Spotify, SoundCloud, Vimeo), при их загрузке эти сервисы получают данные посетителя по своим правилам и могут устанавливать свои cookie. Для подключения Discord используются API Discord и сервис присутствия Lanyard.</p>
      </Section>
      <Section title="5. Зачем мы обрабатываем данные">
        <p>Чтобы работали аккаунты и публичные страницы, показывалась статистика владельцу страницы, обеспечивалась безопасность (защита от подбора паролей и злоупотреблений) и создавались резервные копии.</p>
      </Section>
      <Section title="6. Индексация поисковиками">
        <p>По умолчанию ваша страница скрыта от поисковых систем. Включить индексацию можно в настройках кабинета, выключить её можно в любой момент.</p>
      </Section>
      <Section title="7. Срок хранения и ваши права">
        <p>Данные хранятся, пока существует ваш аккаунт, резервные копии — ограниченное время. Вы можете изменить или удалить данные профиля в кабинете и запросить удаление аккаунта, написав по адресу {legal.operatorContact}.</p>
      </Section>
      <Section title="8. Изменения">
        <p>Мы можем обновлять эту политику. Актуальная версия всегда доступна на этой странице.</p>
      </Section>
      <Extra text={legal.privacyExtra} />
    </>
  );
}

function Terms({ legal }: { legal: LegalSettings }) {
  return (
    <>
      <Section title="1. Общие положения">
        <p>Сервис предоставляет возможность создать публичную био-страницу. Создавая аккаунт, вы принимаете эти условия и Политику конфиденциальности. Оператор: {formatOperator(legal)}, контакт: {legal.operatorContact}.</p>
        {requisitesLines(legal).length > 0 && <p>Реквизиты: {requisitesLines(legal).join(', ')}.</p>}
      </Section>
      <Section title="2. Аккаунт">
        <p>Вы отвечаете за сохранность пароля и за действия под своим аккаунтом. Запрещено выдавать себя за другого человека, команду или администрацию сервиса.</p>
      </Section>
      <Section title="3. Ваш контент">
        <p>Вы сохраняете права на размещаемый контент и подтверждаете, что имеете право его публиковать. Запрещено размещать незаконные материалы, вредоносный код, фишинговые страницы, контент, нарушающий чужие права, а также материалы сексуального характера с участием несовершеннолетних.</p>
      </Section>
      <Section title="4. Ограничения и блокировка">
        <p>Администрация вправе скрыть контент или заблокировать аккаунт при нарушении этих условий или закона, а также при попытках взлома, перегрузки сервиса и злоупотребления загрузкой файлов.</p>
      </Section>
      <Section title="5. Отказ от гарантий">
        <p>Сервис предоставляется «как есть». Мы стараемся обеспечить его бесперебойную работу и сохранность данных, но не гарантируем отсутствие сбоев. Рекомендуем сохранять собственные копии важного контента.</p>
      </Section>
      <Section title="6. Изменения">
        <p>Условия могут меняться. Продолжая пользоваться сервисом после изменений, вы принимаете новую редакцию.</p>
      </Section>
      {legal.jurisdiction && (
        <Section title="7. Применимое право">
          <p>К отношениям сторон применяется право: {legal.jurisdiction}.</p>
        </Section>
      )}
      {legal.abuseContact && (
        <Section title={legal.jurisdiction ? '8. Жалобы' : '7. Жалобы'}>
          <p>Сообщить о нарушении или запросить удаление контента можно по адресу {legal.abuseContact}.</p>
        </Section>
      )}
      <Extra text={legal.termsExtra} />
    </>
  );
}

export default function LegalPage({ doc, onExit }: { doc: Doc; onExit: () => void }) {
  const legal = useLegal();
  return (
    <div className="min-h-screen bg-cb-bg text-white px-6 py-12">
      <main className="max-w-2xl mx-auto space-y-8">
        <button type="button" onClick={onExit} className="text-xs uppercase tracking-wider text-neutral-400 hover:text-white cursor-pointer">
          ← На главную
        </button>
        <header className="space-y-1">
          <h1 className="text-3xl font-black">{TITLES[doc]}</h1>
          <p className="text-xs text-neutral-500">{legal.siteName} · редакция от {formatLegalDate(legal.lastUpdated)}</p>
        </header>
        {doc === 'privacy' ? <Privacy legal={legal} /> : <Terms legal={legal} />}
      </main>
    </div>
  );
}
