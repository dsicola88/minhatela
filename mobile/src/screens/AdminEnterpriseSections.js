import { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, Linking } from 'react-native';
import { EmptyState } from '../components/StateViews';
import { colors } from '../theme/tokens';
import {
  StatusBadge,
  PageHeader,
  cardStyle,
  inputStyle,
  SectionTitle,
  toneForStatus,
  AdminButton,
  ActionRow,
} from './adminUi';
import {
  updateUser,
  upsertPlan,
  updateLead,
  upsertAppConfig,
  reviewCampaign,
  resolveProofUrl,
  patchCatalog,
  updateEditorial,
  reviewReport,
  updateAcquisition,
  updateTenant,
} from '../services/admin';

function getCardStyle() {
  return cardStyle();
}

function CopyField({ label, value, onChangeText, multiline, placeholder }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          color: colors.muted,
          fontSize: 11,
          fontWeight: '700',
          marginBottom: 6,
          letterSpacing: 0.6,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={value ?? ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={inputStyle(multiline ? { minHeight: 88, textAlignVertical: 'top' } : {})}
      />
    </View>
  );
}

function SettingObjectForm({
  settingKey,
  title,
  fields,
  settings,
  run,
  busy,
  transformIn,
  transformOut,
}) {
  const setting = settings.find((s) => s.key === settingKey) || { value: {}, description: '' };
  const incoming = transformIn ? transformIn(setting.value || {}) : { ...(setting.value || {}) };
  const [draft, setDraft] = useState(incoming);

  useEffect(() => {
    setDraft(transformIn ? transformIn(setting.value || {}) : { ...(setting.value || {}) });
  }, [setting.updatedAt, settingKey]);

  function setField(key, val) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  return (
    <View style={getCardStyle()}>
      <Text style={{ color: colors.gold, fontWeight: '800', letterSpacing: 1, marginBottom: 4 }}>
        {title}
      </Text>
      {setting.description ? (
        <Text style={{ color: colors.muted, marginBottom: 14 }}>{setting.description}</Text>
      ) : (
        <View style={{ height: 8 }} />
      )}
      {fields.map((f) =>
        f.type === 'switch' ? (
          <View
            key={f.key}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: colors.text, flex: 1, paddingRight: 12 }}>{f.label}</Text>
            <Switch value={Boolean(draft[f.key])} onValueChange={(v) => setField(f.key, v)} />
          </View>
        ) : (
          <CopyField
            key={f.key}
            label={f.label}
            value={draft[f.key] == null ? '' : String(draft[f.key])}
            onChangeText={(v) => setField(f.key, v)}
            multiline={f.multiline}
            placeholder={f.placeholder}
          />
        )
      )}
      <AdminButton
        label={busy === `cfg-${settingKey}` ? 'A guardar…' : 'Guardar textos'}
        onPress={() =>
          run(`cfg-${settingKey}`, async () => {
            const raw = transformOut ? transformOut(draft) : draft;
            const payload = {};
            Object.entries(raw || {}).forEach(([k, v]) => {
              if (v === '' && k !== 'homeAnnouncement' && k !== 'heroImageUrl') return;
              payload[k] = v;
            });
            await upsertAppConfig(settingKey, payload, setting.description);
          })
        }
      />
    </View>
  );
}

function landingIn(v) {
  const sections = Array.isArray(v.sections) ? v.sections : [];
  return {
    enabled: v.enabled !== false,
    heroTitle: v.heroTitle || '',
    heroSubtitle: v.heroSubtitle || '',
    heroCtaPrimary: v.heroCtaPrimary || '',
    heroCtaSecondary: v.heroCtaSecondary || '',
    heroImageUrl: v.heroImageUrl || '',
    leadHeadline: v.leadHeadline || '',
    showLeadForm: v.showLeadForm !== false,
    section1Id: sections[0]?.id || 'avod',
    section1Title: sections[0]?.title || '',
    section1Body: sections[0]?.body || '',
    section2Id: sections[1]?.id || 'premium',
    section2Title: sections[1]?.title || '',
    section2Body: sections[1]?.body || '',
    section3Id: sections[2]?.id || 'pay',
    section3Title: sections[2]?.title || '',
    section3Body: sections[2]?.body || '',
  };
}

function landingOut(d) {
  return {
    enabled: d.enabled !== false,
    heroTitle: d.heroTitle,
    heroSubtitle: d.heroSubtitle,
    heroCtaPrimary: d.heroCtaPrimary,
    heroCtaSecondary: d.heroCtaSecondary,
    heroImageUrl: d.heroImageUrl || null,
    leadHeadline: d.leadHeadline,
    showLeadForm: d.showLeadForm !== false,
    sections: [
      { id: d.section1Id || 'avod', title: d.section1Title, body: d.section1Body },
      { id: d.section2Id || 'premium', title: d.section2Title, body: d.section2Body },
      { id: d.section3Id || 'pay', title: d.section3Title, body: d.section3Body },
    ],
  };
}

function OnboardingForm({ settings, run, busy }) {
  const setting = settings.find((s) => s.key === 'onboarding') || { value: {} };
  const [enabled, setEnabled] = useState(true);
  const [slides, setSlides] = useState([]);

  useEffect(() => {
    const v = setting.value || {};
    setEnabled(v.enabled !== false);
    setSlides(
      Array.isArray(v.slides) && v.slides.length
        ? v.slides.map((s) => ({
            id: s.id || '',
            title: s.title || '',
            subtitle: s.subtitle || '',
            cta: s.cta || '',
          }))
        : [{ id: 'welcome', title: '', subtitle: '', cta: '' }]
    );
  }, [setting.updatedAt]);

  return (
    <View style={getCardStyle()}>
      <Text style={{ color: colors.gold, fontWeight: '800', letterSpacing: 1, marginBottom: 12 }}>
        ONBOARDING
      </Text>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <Text style={{ color: colors.text }}>Slides activos</Text>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>
      {slides.map((slide, index) => (
        <View key={`${slide.id}-${index}`} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.textSecondary, fontWeight: '700', marginBottom: 8 }}>
            Slide {index + 1}
          </Text>
          <CopyField
            label="Título"
            value={slide.title}
            onChangeText={(title) =>
              setSlides((list) => list.map((s, i) => (i === index ? { ...s, title } : s)))
            }
          />
          <CopyField
            label="Subtítulo"
            value={slide.subtitle}
            onChangeText={(subtitle) =>
              setSlides((list) => list.map((s, i) => (i === index ? { ...s, subtitle } : s)))
            }
            multiline
          />
          <CopyField
            label="CTA"
            value={slide.cta}
            onChangeText={(cta) =>
              setSlides((list) => list.map((s, i) => (i === index ? { ...s, cta } : s)))
            }
          />
        </View>
      ))}
      <ActionRow>
        <AdminButton
          label="Adicionar slide"
          variant="outline"
          onPress={() =>
            setSlides((list) => [
              ...list,
              { id: `slide-${list.length + 1}`, title: '', subtitle: '', cta: '' },
            ])
          }
        />
        <AdminButton
          label={busy === 'cfg-onboarding' ? 'A guardar…' : 'Guardar textos'}
          onPress={() =>
            run('cfg-onboarding', () =>
              upsertAppConfig(
                'onboarding',
                { enabled, slides },
                setting.description || 'Slides de onboarding da app'
              )
            )
          }
        />
      </ActionRow>
    </View>
  );
}

export function LandingPaymentsTab({ settings, run, busy }) {
  return (
    <View>
      <PageHeader
        compact
        subtitle="Textos da página de entrada, CTAs, leads e etiquetas IBAN / Multicaixa."
      />
      <SettingObjectForm
        settingKey="landing"
        title="LANDING"
        settings={settings}
        run={run}
        busy={busy}
        transformIn={landingIn}
        transformOut={landingOut}
        fields={[
          { key: 'enabled', label: 'Landing activa', type: 'switch' },
          { key: 'heroTitle', label: 'Título principal' },
          { key: 'heroSubtitle', label: 'Subtítulo', multiline: true },
          { key: 'heroCtaPrimary', label: 'Botão principal' },
          { key: 'heroCtaSecondary', label: 'Botão secundário' },
          { key: 'heroImageUrl', label: 'URL da imagem de fundo' },
          { key: 'leadHeadline', label: 'Título do formulário de leads' },
          { key: 'showLeadForm', label: 'Mostrar formulário de leads', type: 'switch' },
          { key: 'section1Title', label: 'Bloco 1 — título' },
          { key: 'section1Body', label: 'Bloco 1 — texto', multiline: true },
          { key: 'section2Title', label: 'Bloco 2 — título' },
          { key: 'section2Body', label: 'Bloco 2 — texto', multiline: true },
          { key: 'section3Title', label: 'Bloco 3 — título' },
          { key: 'section3Body', label: 'Bloco 3 — texto', multiline: true },
        ]}
      />
      <SettingObjectForm
        settingKey="payments"
        title="PAGAMENTOS (TEXTOS)"
        settings={settings}
        run={run}
        busy={busy}
        fields={[
          { key: 'ibanEnabled', label: 'IBAN activo', type: 'switch' },
          { key: 'multicaixaEnabled', label: 'Multicaixa activa', type: 'switch' },
          { key: 'ibanLabel', label: 'Etiqueta IBAN' },
          { key: 'ibanInstructions', label: 'Instruções IBAN', multiline: true },
          { key: 'multicaixaLabel', label: 'Etiqueta Multicaixa' },
          { key: 'multicaixaInstructions', label: 'Instruções Multicaixa', multiline: true },
        ]}
      />
    </View>
  );
}

const FORM_KEYS = new Set(['branding', 'landing', 'payments', 'onboarding', 'support']);

export function CopySettingsTab({ settings, configDrafts, setConfigDrafts, run, busy }) {
  const extras = settings.filter((s) => !FORM_KEYS.has(s.key));
  return (
    <View>
      <PageHeader
        compact
        subtitle="Nome, slogans, avisos da Home, onboarding e contactos. A app lê GET /api/app/config."
      />
      <SettingObjectForm
        settingKey="branding"
        title="MARCA E HOME"
        settings={settings}
        run={run}
        busy={busy}
        fields={[
          { key: 'appName', label: 'Nome da app (navbar, login, conta)' },
          { key: 'tagline', label: 'Slogan' },
          { key: 'billboardKicker', label: 'Selo do billboard' },
          { key: 'playLabel', label: 'Botão reproduzir' },
          { key: 'moreInfoLabel', label: 'Botão mais informações' },
          {
            key: 'homeAnnouncement',
            label: 'Aviso na Home (vazio = oculto)',
            multiline: true,
          },
          { key: 'emptyCatalog', label: 'Catálogo vazio — título' },
          { key: 'emptySubtitle', label: 'Catálogo vazio — subtítulo' },
          { key: 'maintenanceMessage', label: 'Mensagem de manutenção', multiline: true },
        ]}
      />
      <OnboardingForm settings={settings} run={run} busy={busy} />
      <SettingObjectForm
        settingKey="support"
        title="CONTACTOS DE SUPORTE"
        settings={settings}
        run={run}
        busy={busy}
        fields={[
          { key: 'email', label: 'Email' },
          { key: 'whatsapp', label: 'WhatsApp' },
          { key: 'hours', label: 'Horário' },
          { key: 'slaHours', label: 'SLA (horas)' },
        ]}
      />
      {extras.map((s) => (
        <View key={s.key} style={getCardStyle()}>
          <Text style={{ color: colors.gold, fontWeight: '800', letterSpacing: 1 }}>
            {s.key.toUpperCase()}
          </Text>
          {s.description ? (
            <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 8 }}>{s.description}</Text>
          ) : null}
          <TextInput
            value={configDrafts[s.key] ?? ''}
            onChangeText={(v) => setConfigDrafts((d) => ({ ...d, [s.key]: v }))}
            multiline
            autoCapitalize="none"
            style={inputStyle({
              minHeight: 140,
              fontFamily: 'monospace',
              textAlignVertical: 'top',
            })}
          />
          <AdminButton
            label={busy === `cfg-${s.key}` ? '…' : 'Guardar'}
            onPress={() =>
              run(`cfg-${s.key}`, async () => {
                let parsed;
                try {
                  parsed = JSON.parse(configDrafts[s.key] || '{}');
                } catch {
                  throw new Error(`JSON inválido em ${s.key}`);
                }
                await upsertAppConfig(s.key, parsed, s.description);
              })
            }
          />
        </View>
      ))}
    </View>
  );
}

function CatalogTitleCard({ item, run }) {
  const [title, setTitle] = useState(item.title);
  const [synopsis, setSynopsis] = useState(item.synopsisShort || '');

  useEffect(() => {
    setTitle(item.title);
    setSynopsis(item.synopsisShort || '');
  }, [item.id, item.title, item.synopsisShort]);

  return (
    <View style={getCardStyle()}>
      <CopyField label="Título no catálogo" value={title} onChangeText={setTitle} />
      <CopyField
        label="Sinopse curta (billboard e cartões)"
        value={synopsis}
        onChangeText={setSynopsis}
        multiline
      />
      <Text style={{ color: colors.muted, marginBottom: 8 }}>
        {item.kind} · {item.monetization}
        {item.rentalPriceKz != null ? ` · ${item.rentalPriceKz} Kz` : ''} ·{' '}
        {item.isPublished ? 'publicado' : 'oculto'}
        {item.isFeatured ? ' · FEATURED' : ''} · {item.workflowStatus}
      </Text>
      <ActionRow>
        <AdminButton
          label="Guardar título e sinopse"
          onPress={() =>
            run(`cat-save-${item.id}`, () => {
              if (!title.trim()) throw new Error('O título não pode ficar vazio');
              const payload = { title: title.trim() };
              if (synopsis.trim()) payload.synopsisShort = synopsis.trim();
              return patchCatalog(item.id, payload);
            })
          }
        />
        <AdminButton
          label={item.isPublished ? 'Despublicar' : 'Publicar'}
          variant="outline"
          onPress={() =>
            run(`cat-p-${item.id}`, () =>
              patchCatalog(item.id, {
                isPublished: !item.isPublished,
                workflowStatus: !item.isPublished ? 'published' : 'archived',
              })
            )
          }
        />
        <AdminButton
          label={item.isFeatured ? 'Remover destaque' : 'Destacar'}
          variant="outline"
          onPress={() =>
            run(`cat-f-${item.id}`, () => patchCatalog(item.id, { isFeatured: !item.isFeatured }))
          }
        />
        <AdminButton
          label="AVOD"
          variant="outline"
          onPress={() =>
            run(`cat-a-${item.id}`, () =>
              patchCatalog(item.id, { monetization: 'avod', rentalPriceKz: null })
            )
          }
        />
        <AdminButton
          label="SVOD"
          variant="outline"
          onPress={() =>
            run(`cat-s-${item.id}`, () =>
              patchCatalog(item.id, { monetization: 'svod', rentalPriceKz: null })
            )
          }
        />
        <AdminButton
          label="TVOD 1500"
          variant="outline"
          onPress={() =>
            run(`cat-t-${item.id}`, () =>
              patchCatalog(item.id, { monetization: 'tvod', rentalPriceKz: 1500 })
            )
          }
        />
      </ActionRow>
    </View>
  );
}

export function UsersTab({ users, userQuery, setUserQuery, onSearch, run }) {
  return (
    <View>
      <PageHeader
        compact
        subtitle="Pesquisa, papéis e entitlements. Promoção a SuperAdmin segue four-eyes."
      />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <TextInput
          value={userQuery}
          onChangeText={setUserQuery}
          placeholder="Pesquisar email ou nome"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={inputStyle({ flex: 1, minWidth: 200, marginBottom: 0 })}
        />
        <AdminButton label="Pesquisar" onPress={onSearch} />
      </View>
      {users.length === 0 ? (
        <EmptyState title="Sem utilizadores" />
      ) : (
        users.map((u) => (
          <View key={u.id} style={getCardStyle()}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
              {u.fullName || 'Sem nome'}
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 2, fontSize: 13 }}>{u.email}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <StatusBadge tone={toneForStatus(u.subscriptionStatus)}>
                {u.subscriptionStatus || 'none'}
              </StatusBadge>
              {u.isAdmin ? <StatusBadge tone="gold">admin</StatusBadge> : null}
              {(u.roles || []).slice(0, 4).map((r) => (
                <StatusBadge key={r} tone={r === 'super_admin' ? 'gold' : 'info'}>
                  {r.replace(/_/g, ' ')}
                </StatusBadge>
              ))}
            </View>
            {u.premiumExpiresAt ? (
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Premium até {new Date(u.premiumExpiresAt).toLocaleDateString('pt-AO')}
              </Text>
            ) : null}
            <ActionRow>
              <AdminButton
                label={u.isAdmin ? 'Remover admin' : 'Tornar admin'}
                variant="outline"
                onPress={() =>
                  run(`u-adm-${u.id}`, () => updateUser(u.id, { isAdmin: !u.isAdmin }))
                }
              />
              <AdminButton
                label="Dar Premium 30d"
                onPress={() =>
                  run(`u-pre-${u.id}`, () =>
                    updateUser(u.id, {
                      subscriptionStatus: 'premium_active',
                      premiumExpiresAt: new Date(
                        Date.now() + 30 * 24 * 3600 * 1000
                      ).toISOString(),
                    })
                  )
                }
              />
              <AdminButton
                label="Revogar Premium"
                variant="outline"
                onPress={() =>
                  run(`u-rev-${u.id}`, () =>
                    updateUser(u.id, {
                      subscriptionStatus: 'none',
                      premiumExpiresAt: null,
                    })
                  )
                }
              />
            </ActionRow>
          </View>
        ))
      )}
    </View>
  );
}

export function PlansTab({ plans, run, busy }) {
  const [form, setForm] = useState({
    id: 'premium',
    name: 'Premium',
    priceKz: '4990',
    streams: '2',
    downloads: '10',
    ads: false,
  });

  return (
    <View>
      <PageHeader compact subtitle="Preços e benefícios em Kz — mercado Angola / AOA." />
      <View style={getCardStyle()}>
        <TextInput
          value={form.id}
          onChangeText={(id) => setForm((f) => ({ ...f, id }))}
          placeholder="id (ex: premium)"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={inputStyle()}
        />
        <TextInput
          value={form.name}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          placeholder="Nome"
          placeholderTextColor={colors.muted}
          style={inputStyle()}
        />
        <TextInput
          value={form.priceKz}
          onChangeText={(priceKz) => setForm((f) => ({ ...f, priceKz }))}
          placeholder="Preço Kz"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          style={inputStyle()}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Text style={{ color: colors.textSecondary }}>Anúncios AVOD</Text>
          <Switch
            value={form.ads}
            onValueChange={(ads) => setForm((f) => ({ ...f, ads }))}
            trackColor={{ false: colors.border, true: colors.red }}
          />
        </View>
        <AdminButton
          label={busy === 'plan-save' ? '…' : 'Guardar plano'}
          onPress={() =>
            run('plan-save', () =>
              upsertPlan(form.id, {
                name: form.name,
                priceKz: Number(form.priceKz) || 0,
                period: form.id === 'free' ? null : 'month',
                streams: Number(form.streams) || 1,
                downloads: Number(form.downloads) || 0,
                ads: form.ads,
                highlights:
                  form.id === 'free'
                    ? ['Catálogo AVOD', 'Poupança de dados']
                    : ['Sem anúncios', 'Downloads', 'Multi-ecrã'],
                badge: form.id === 'premium' ? 'Recomendado' : null,
                isDefault: form.id === 'free',
              })
            )
          }
        />
      </View>
      {plans.map((p) => (
        <View key={p.id} style={getCardStyle()}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {p.name} · {Number(p.priceKz || 0).toLocaleString('pt-AO')} Kz
          </Text>
          <Text style={{ color: colors.muted }}>
            {p.id} · {p.streams} streams · {p.downloads} downloads ·{' '}
            {p.ads ? 'com ads' : 'sem ads'} · {p.isActive ? 'activo' : 'inactivo'}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function LeadsTab({ leads, run }) {
  return (
    <View>
      <PageHeader compact subtitle="Contactos da landing e WhatsApp — pipeline comercial Angola." />
      {leads.length === 0 ? (
        <EmptyState title="Sem leads" subtitle="O formulário público POST /api/leads alimenta esta fila." />
      ) : (
        leads.map((l) => (
          <View key={l.id} style={getCardStyle()}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {l.fullName || '—'} · {l.email}
            </Text>
            <Text style={{ color: colors.muted }}>
              {l.phone || 'sem telefone'} · {l.interest} · {l.source} · {l.status}
            </Text>
            <ActionRow>
              {[
                ['contacted', 'Contactado'],
                ['qualified', 'Qualificado'],
                ['converted', 'Convertido'],
                ['discarded', 'Descartar'],
              ].map(([st, label]) => (
                <AdminButton
                  key={st}
                  label={label}
                  variant="outline"
                  onPress={() => run(`lead-${l.id}-${st}`, () => updateLead(l.id, { status: st }))}
                />
              ))}
            </ActionRow>
          </View>
        ))
      )}
    </View>
  );
}

export function UploadsTab({ uploads, proofs, onPickUpload, busy }) {
  return (
    <View>
      <PageHeader compact subtitle="Assets de landing/ads e comprovativos IBAN / Multicaixa." />
      <AdminButton
        label={busy === 'upload' ? 'A enviar…' : 'Carregar asset (web)'}
        onPress={onPickUpload}
      />
      <SectionTitle>Media library</SectionTitle>
      {uploads.length === 0 ? (
        <EmptyState title="Sem uploads" />
      ) : (
        uploads.map((u) => (
          <View key={u.id} style={getCardStyle()}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {u.originalName || u.url}
            </Text>
            <Text style={{ color: colors.muted }}>
              {u.kind} · {(u.sizeBytes / 1024).toFixed(1)} KB
            </Text>
            <AdminButton
              label="Abrir"
              variant="outline"
              onPress={() => Linking.openURL(resolveProofUrl(u.url))}
            />
          </View>
        ))
      )}
      <SectionTitle>Comprovativos de pagamento</SectionTitle>
      {proofs.length === 0 ? (
        <EmptyState title="Sem comprovativos" />
      ) : (
        proofs.map((p) => (
          <View key={p.transactionId} style={getCardStyle()}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {p.fullName} · {p.email}
            </Text>
            <Text style={{ color: colors.muted }}>
              {p.status} · {p.amountKz?.toLocaleString('pt-AO')} Kz
            </Text>
            {p.proofUrl ? (
              <AdminButton
                label="Ver comprovativo"
                variant="outline"
                onPress={() => Linking.openURL(resolveProofUrl(p.proofUrl))}
              />
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

export function AdsTab({ campaigns, run }) {
  return (
    <View>
      <PageHeader compact subtitle="Campanhas AVOD — aprovação, pausa e revisão." />
      {campaigns.length === 0 ? (
        <EmptyState title="Sem campanhas" />
      ) : (
        campaigns.map((c) => (
          <View key={c.id} style={getCardStyle()}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{c.name}</Text>
            <Text style={{ color: colors.muted }}>
              {c.companyName} · {c.placement} · orçamento{' '}
              {c.budgetKz?.toLocaleString('pt-AO')} Kz · gasto {c.spentKz?.toLocaleString('pt-AO')}{' '}
              Kz · {c.status}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <AdminButton
                label="Activar"
                onPress={() => run(`ad-a-${c.id}`, () => reviewCampaign(c.id, 'active'))}
              />
              <AdminButton
                label="Pausar"
                variant="outline"
                onPress={() => run(`ad-p-${c.id}`, () => reviewCampaign(c.id, 'paused'))}
              />
              <AdminButton
                label="Rejeitar"
                variant="outline"
                onPress={() => run(`ad-r-${c.id}`, () => reviewCampaign(c.id, 'rejected'))}
              />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export function CatalogCmsTab({ titles, catalogQuery, setCatalogQuery, onSearch, run }) {
  return (
    <View>
      <PageHeader
        compact
        subtitle="Editar títulos e sinopses reais do catálogo. Publicar, destacar e monetização."
      />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <TextInput
          value={catalogQuery}
          onChangeText={setCatalogQuery}
          placeholder="Pesquisar título"
          placeholderTextColor={colors.muted}
          style={inputStyle({ flex: 1, minWidth: 200, marginBottom: 0 })}
        />
        <AdminButton label="Pesquisar" onPress={onSearch} />
      </View>
      {titles.length === 0 ? (
        <EmptyState title="Sem títulos" />
      ) : (
        titles.map((item) => <CatalogTitleCard key={item.id} item={item} run={run} />)
      )}
    </View>
  );
}

export function EditorialCollectionCard({ collection, run }) {
  const [title, setTitle] = useState(collection.title || '');
  const [subtitle, setSubtitle] = useState(collection.subtitle || '');

  useEffect(() => {
    setTitle(collection.title || '');
    setSubtitle(collection.subtitle || '');
  }, [collection.id, collection.title, collection.subtitle]);

  return (
    <View style={getCardStyle()}>
      <Text style={{ color: colors.muted, marginBottom: 8 }}>
        {collection.slug} · {collection.placement || 'home'} ·{' '}
        {collection.isPublished !== false ? 'publicada' : 'rascunho'}
      </Text>
      <CopyField label="Título da fila (Home)" value={title} onChangeText={setTitle} />
      <CopyField label="Subtítulo" value={subtitle} onChangeText={setSubtitle} />
      <ActionRow>
        <AdminButton
          label="Guardar textos da fila"
          onPress={() =>
            run(`ed-txt-${collection.id}`, () => {
              if (!title.trim()) throw new Error('O título da fila é obrigatório');
              return updateEditorial(collection.id, { title: title.trim(), subtitle: subtitle.trim() });
            })
          }
        />
        <AdminButton
          label={collection.isPublished === false ? 'Publicar' : 'Despublicar'}
          variant="outline"
          onPress={() =>
            run(`ed-${collection.id}`, () =>
              updateEditorial(collection.id, { isPublished: collection.isPublished === false })
            )
          }
        />
      </ActionRow>
    </View>
  );
}

export function ReportsTab({ reports, run }) {
  return (
    <View>
      <PageHeader compact subtitle="Fila de reports de conteúdo — Trust & Safety operacional." />
      {reports.length === 0 ? (
        <EmptyState title="Fila limpa" />
      ) : (
        reports.map((r) => (
          <View key={r.id} style={getCardStyle()}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {r.reason || r.category || 'Denúncia'} · {r.contentTitle || r.contentId}
            </Text>
            <Text style={{ color: colors.muted }}>
              {r.status} · {r.email || r.reporterEmail || '—'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <AdminButton
                label="Resolver"
                onPress={() =>
                  run(`rep-${r.id}`, () =>
                    reviewReport(r.id, { status: 'resolved', notes: 'Revisado' })
                  )
                }
              />
              <AdminButton
                label="Descartar"
                variant="outline"
                onPress={() =>
                  run(`rep-d-${r.id}`, () =>
                    reviewReport(r.id, { status: 'dismissed', notes: 'Sem acção' })
                  )
                }
              />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export function AcquisitionTab({ items, run }) {
  return (
    <View>
      <PageHeader compact subtitle="Prospecto → contrato → QC → publicado. Território e monetização por título." />
      {(items || []).length === 0 ? (
        <EmptyState title="Sem aquisições" />
      ) : (
        items.map((a) => (
          <View key={a.id} style={getCardStyle()}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{a.title}</Text>
            <Text style={{ color: colors.muted }}>
              {a.status} · {a.territory} · {a.monetization} · {a.producerName || '—'}
            </Text>
            <ActionRow>
              {[
                ['contacted', 'Contacto'],
                ['negotiation', 'Negociação'],
                ['licensed', 'Licenciado'],
                ['qc', 'QC'],
                ['approved', 'Aprovado'],
                ['published', 'Publicado'],
                ['rejected', 'Rejeitar'],
              ].map(([st, label]) => (
                <AdminButton
                  key={st}
                  label={label}
                  variant={st === 'rejected' ? 'outline' : 'outline'}
                  onPress={() =>
                    run(`acq-${a.id}-${st}`, () =>
                      updateAcquisition(a.id, { status: st, notes: `ops:${st}` })
                    )
                  }
                />
              ))}
            </ActionRow>
          </View>
        ))
      )}
    </View>
  );
}

export function RightsTab({ items }) {
  return (
    <View>
      <PageHeader compact subtitle="Licença activa, território, janela e modalidades AVOD / SVOD / TVOD / LIVE." />
      {(items || []).length === 0 ? (
        <EmptyState title="Sem licenças registadas (legado = permitido)" />
      ) : (
        items.map((r) => (
          <View key={r.id} style={getCardStyle()}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {r.territory} · {r.licenseType} · {r.status}
            </Text>
            <Text style={{ color: colors.muted }}>
              AVOD {r.allowAvod ? 'sim' : 'não'} · SVOD {r.allowSvod ? 'sim' : 'não'} · TVOD{' '}
              {r.allowTvod ? 'sim' : 'não'} · LIVE {r.allowLive ? 'sim' : 'não'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
              {r.startsAt} → {r.endsAt || 'sem termo'}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

export function TenantsTab({ items, run }) {
  const [reasons, setReasons] = useState({});
  return (
    <View>
      <PageHeader
        compact
        subtitle="Isolamento de mercado. Suspender exige motivo e pode entrar em four-eyes."
      />
      {(items || []).length === 0 ? (
        <EmptyState title="Sem tenants" />
      ) : (
        items.map((t) => (
          <View key={t.id} style={getCardStyle()}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  {t.slug} · {t.market || 'AO'}
                </Text>
              </View>
              <StatusBadge tone={toneForStatus(t.status)}>{t.status}</StatusBadge>
            </View>
            <TextInput
              value={reasons[t.id] || ''}
              onChangeText={(v) => setReasons((m) => ({ ...m, [t.id]: v }))}
              placeholder="Motivo auditado (obrigatório para suspender)"
              placeholderTextColor={colors.muted}
              style={inputStyle({ marginTop: 12 })}
            />
            {t.status === 'active' ? (
              <AdminButton
                label="Suspender tenant"
                variant="outline"
                onPress={() =>
                  run(`ten-${t.id}`, () => {
                    const reason = String(reasons[t.id] || '').trim();
                    if (reason.length < 8) {
                      throw new Error('Escreva um motivo auditado (mín. 8 caracteres) para suspender');
                    }
                    return updateTenant(t.id, { status: 'suspended', reason });
                  })
                }
              />
            ) : (
              <AdminButton
                label="Reactivar"
                onPress={() =>
                  run(`ten-a-${t.id}`, () => {
                    const reason = String(reasons[t.id] || '').trim();
                    if (reason.length < 8) {
                      throw new Error('Escreva um motivo auditado (mín. 8 caracteres) para reactivar');
                    }
                    return updateTenant(t.id, { status: 'active', reason });
                  })
                }
              />
            )}
          </View>
        ))
      )}
    </View>
  );
}
