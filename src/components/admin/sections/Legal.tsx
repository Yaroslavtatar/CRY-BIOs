import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Save } from 'lucide-react';
import { Badge, Button, Card, Field, PageHeader, TextArea, TextInput, Toggle } from '../ui';
import {
  DEFAULT_LEGAL,
  formatLegalDate,
  formatOperator,
  isLegalConfigured,
  normalizeLegal,
  requisitesLines,
  type LegalSettings,
} from '../../../legalConfig';
import type { SectionProps } from './types';

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

export default function Legal({ api, notify }: SectionProps) {
  const [saved, setSaved] = useState<LegalSettings | null>(null);
  const [form, setForm] = useState<LegalSettings>(DEFAULT_LEGAL);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = normalizeLegal(await api.get<LegalSettings>('/api/admin/legal'));
      setSaved(data);
      setForm(data);
    } catch (e: any) { notify('error', e.message); }
  }, [api, notify]);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof LegalSettings>(key: K, value: LegalSettings[K]) => setForm((f) => ({ ...f, [key]: value }));

  const dirty = useMemo(() => saved !== null && JSON.stringify(saved) !== JSON.stringify(form), [saved, form]);

  const emailError = (v: string) => (v && !EMAIL_RE.test(v) ? 'Некорректный e-mail' : '');
  const placeholderish = (v: string) => v.startsWith('[заполните');
  const contactErr = placeholderish(form.operatorContact) ? '' : emailError(form.operatorContact);
  const abuseErr = emailError(form.abuseContact);
  const hasErrors = Boolean(contactErr || abuseErr);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.send<LegalSettings & { success: boolean }>('PUT', '/api/admin/legal', {
        ...form,
        // плейсхолдеры по умолчанию не отправляем как значения
        operatorName: placeholderish(form.operatorName) ? '' : form.operatorName,
        operatorContact: placeholderish(form.operatorContact) ? '' : form.operatorContact,
      });
      const { success: _s, ...rest } = res;
      const next = normalizeLegal(rest);
      setSaved(next);
      setForm(next);
      notify('success', 'Юридические данные сохранены');
    } catch (e: any) { notify('error', e.message); }
    finally { setSaving(false); }
  };

  const configured = isLegalConfigured(form);
  const lines = requisitesLines(form);

  return (
    <>
      <PageHeader
        title="Юридические данные"
        description="Оператор сервиса, реквизиты и дополнительные положения. Подставляются в Политику конфиденциальности, Условия использования и подвал главной."
        actions={
          <>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white"><ExternalLink className="h-3.5 w-3.5" />Политика</a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white"><ExternalLink className="h-3.5 w-3.5" />Условия</a>
            <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={saving} disabled={!dirty || hasErrors} onClick={save}>Сохранить</Button>
          </>
        }
      />

      {!configured && (
        <p role="status" className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Данные оператора не заполнены: на страницах документов видны заглушки в квадратных скобках. Укажите имя оператора и e-mail для обращений.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Оператор" description="Кто отвечает за обработку данных пользователей.">
          <div className="space-y-4">
            <Field label="Название сервиса" hint="Показывается в шапке документов.">
              <TextInput value={form.siteName} maxLength={60} onChange={(e) => set('siteName', e.target.value)} />
            </Field>
            <Field label="Организационная форма" hint="Например: ИП, ООО, Самозанятый, Физическое лицо. Можно оставить пустым.">
              <TextInput value={form.operatorForm} maxLength={60} onChange={(e) => set('operatorForm', e.target.value)} />
            </Field>
            <Field label="ФИО или наименование">
              <TextInput value={placeholderish(form.operatorName) ? '' : form.operatorName} maxLength={200} placeholder="Иванов Иван Иванович" onChange={(e) => set('operatorName', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ИНН"><TextInput value={form.taxId} maxLength={40} inputMode="numeric" onChange={(e) => set('taxId', e.target.value)} /></Field>
              <Field label="ОГРН / ОГРНИП"><TextInput value={form.regNumber} maxLength={40} inputMode="numeric" onChange={(e) => set('regNumber', e.target.value)} /></Field>
            </div>
            <Field label="Адрес" hint="Юридический или почтовый. Необязательно.">
              <TextInput value={form.address} maxLength={300} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Контакты и право">
          <div className="space-y-4">
            <Field label="E-mail для обращений" hint={contactErr || 'По вопросам данных, удаления аккаунта и поддержки.'}>
              <TextInput type="email" value={placeholderish(form.operatorContact) ? '' : form.operatorContact} maxLength={120} placeholder="support@example.com" aria-invalid={Boolean(contactErr)} onChange={(e) => set('operatorContact', e.target.value)} />
            </Field>
            <Field label="E-mail для жалоб на контент" hint={abuseErr || 'Если не указан, раздел о жалобах не показывается.'}>
              <TextInput type="email" value={form.abuseContact} maxLength={120} placeholder="abuse@example.com" aria-invalid={Boolean(abuseErr)} onChange={(e) => set('abuseContact', e.target.value)} />
            </Field>
            <Field label="Применимое право" hint="Например: Российская Федерация. Если пусто, раздел не показывается.">
              <TextInput value={form.jurisdiction} maxLength={120} onChange={(e) => set('jurisdiction', e.target.value)} />
            </Field>
            <Field label="Дата редакции" hint="При изменении текстов обновляется автоматически, если вы не меняли её вручную.">
              <TextInput type="date" value={form.lastUpdated} onChange={(e) => e.target.value && set('lastUpdated', e.target.value)} />
            </Field>
            <Toggle
              checked={form.showRequisitesInFooter}
              onChange={(v) => set('showRequisitesInFooter', v)}
              label="Показывать реквизиты в подвале главной"
              description="Оператор, ИНН, ОГРН, адрес и e-mail одной строкой под ссылками на документы."
            />
          </div>
        </Card>
      </div>

      <Card className="mt-4" title="Дополнительные положения" description="Обычный текст, абзацы разделяются пустой строкой. HTML не поддерживается. Добавляется в конец документа отдельным разделом.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="В конец Политики конфиденциальности" hint={`${form.privacyExtra.length}/4000`}>
            <TextArea rows={7} maxLength={4000} value={form.privacyExtra} onChange={(e) => set('privacyExtra', e.target.value)} />
          </Field>
          <Field label="В конец Условий использования" hint={`${form.termsExtra.length}/4000`}>
            <TextArea rows={7} maxLength={4000} value={form.termsExtra} onChange={(e) => set('termsExtra', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="mt-4" title="Как это выглядит">
        <div className="space-y-1 text-sm text-neutral-300">
          <p><span className="text-neutral-500">Оператор:</span> {formatOperator(form)}</p>
          {lines.length > 0 && <p><span className="text-neutral-500">Реквизиты:</span> {lines.join(', ')}</p>}
          <p><span className="text-neutral-500">Редакция:</span> {form.siteName} · {formatLegalDate(form.lastUpdated)}</p>
          <p className="pt-1">{configured ? <Badge tone="success">Данные заполнены</Badge> : <Badge tone="warning">Нужно заполнить</Badge>}</p>
        </div>
        {dirty && <p className="mt-3 text-xs text-neutral-500">Есть несохранённые изменения. Страницы документов обновятся после сохранения.</p>}
      </Card>
    </>
  );
}
