import { useState } from 'react';
import { View, Text, TextInput, Switch, Linking } from 'react-native';
import { PrimaryButton } from '../components/ui';
import { EmptyState } from '../components/StateViews';
import { colors } from '../theme/tokens';
import {
  updateUser,
  upsertPlan,
  updateLead,
  upsertAppConfig,
  reviewCampaign,
  resolveProofUrl,
  patchCatalog,
  reviewReport,
} from '../services/admin';

function getCardStyle() {
  return {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
  };
}

function SectionTitle({ children }) {
  return (
    <Text
      style={{
        color: colors.gold,
        fontWeight: '700',
        letterSpacing: 1,
        marginTop: 8,
        marginBottom: 12,
      }}
    >
      {children}
    </Text>
  );
}

function inputStyle(extra = {}) {
  return {
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: 10,
    borderRadius: 4,
    marginBottom: 10,
    ...extra,
  };
}

export function LandingPaymentsTab({
  settings,
  configDrafts,
  setConfigDrafts,
  run,
  busy,
}) {
  const landing = settings.find((s) => s.key === 'landing');
  const payments = settings.find((s) => s.key === 'payments');

  return (
    <View>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
        Landing page & Pagamentos AO
      </Text>
      <Text style={{ color: colors.muted, marginBottom: 16 }}>
        Personalize hero, CTAs, formulário de leads e métodos IBAN/Multicaixa.
      </Text>

      {[landing, payments].filter(Boolean).map((s) => (
        <View key={s.key} style={getCardStyle()}>
          <Text style={{ color: colors.gold, fontWeight: '800', letterSpacing: 1 }}>
            {s.key.toUpperCase()}
          </Text>
          <Text style={{ color: colors.muted, marginVertical: 8 }}>{s.description}</Text>
          <TextInput
            value={configDrafts[s.key] ?? JSON.stringify(s.value || {}, null, 2)}
            onChangeText={(v) => setConfigDrafts((d) => ({ ...d, [s.key]: v }))}
            multiline
            autoCapitalize="none"
            style={inputStyle({
              minHeight: 180,
              fontFamily: 'monospace',
              textAlignVertical: 'top',
            })}
          />
          <PrimaryButton
            label={busy === `cfg-${s.key}` ? '…' : 'Guardar'}
            onPress={() =>
              run(`cfg-${s.key}`, async () => {
                const parsed = JSON.parse(configDrafts[s.key] || '{}');
                await upsertAppConfig(s.key, parsed, s.description);
              })
            }
          />
        </View>
      ))}

      {!landing && !payments ? (
        <EmptyState
          title="Sem landing/payments"
          subtitle="Corra a migração 026 para criar as settings."
        />
      ) : null}
    </View>
  );
}

export function UsersTab({ users, userQuery, setUserQuery, onSearch, run }) {
  return (
    <View>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
        Utilizadores
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <TextInput
          value={userQuery}
          onChangeText={setUserQuery}
          placeholder="Pesquisar email ou nome"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={inputStyle({ flex: 1, minWidth: 200, marginBottom: 0 })}
        />
        <PrimaryButton label="Pesquisar" onPress={onSearch} />
      </View>
      {users.length === 0 ? (
        <EmptyState title="Sem utilizadores" />
      ) : (
        users.map((u) => (
          <View key={u.id} style={getCardStyle()}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {u.fullName} · {u.email}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>
              {u.subscriptionStatus}
              {u.premiumExpiresAt
                ? ` · expira ${new Date(u.premiumExpiresAt).toLocaleDateString('pt-AO')}`
                : ''}
              {u.isAdmin ? ' · ADMIN' : ''}
              {(u.roles || []).length ? ` · ${u.roles.join(', ')}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <PrimaryButton
                label={u.isAdmin ? 'Remover admin' : 'Tornar admin'}
                variant="outline"
                onPress={() =>
                  run(`u-adm-${u.id}`, () => updateUser(u.id, { isAdmin: !u.isAdmin }))
                }
              />
              <PrimaryButton
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
              <PrimaryButton
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
            </View>
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
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
        Planos (Kz)
      </Text>
      <Text style={{ color: colors.muted, marginBottom: 16 }}>
        Preços e benefícios editáveis — mercado Angola / AOA.
      </Text>
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
        <PrimaryButton
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
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
        Leads
      </Text>
      <Text style={{ color: colors.muted, marginBottom: 16 }}>
        Contactos da landing / WhatsApp — pipeline comercial Angola.
      </Text>
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
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {['contacted', 'qualified', 'converted', 'discarded'].map((st) => (
                <PrimaryButton
                  key={st}
                  label={st}
                  variant="outline"
                  onPress={() => run(`lead-${l.id}-${st}`, () => updateLead(l.id, { status: st }))}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export function UploadsTab({ uploads, proofs, onPickUpload, busy }) {
  return (
    <View>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
        Uploads & Comprovativos
      </Text>
      <Text style={{ color: colors.muted, marginBottom: 16 }}>
        Assets de landing/ads e comprovativos IBAN/Multicaixa.
      </Text>
      <PrimaryButton
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
            <PrimaryButton
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
              <PrimaryButton
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
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
        Publicidade / Anúncios
      </Text>
      <Text style={{ color: colors.muted, marginBottom: 16 }}>
        Campanhas AVOD de anunciantes angolanos — aprovação e pausa.
      </Text>
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
              <PrimaryButton
                label="Activar"
                onPress={() => run(`ad-a-${c.id}`, () => reviewCampaign(c.id, 'active'))}
              />
              <PrimaryButton
                label="Pausar"
                variant="outline"
                onPress={() => run(`ad-p-${c.id}`, () => reviewCampaign(c.id, 'paused'))}
              />
              <PrimaryButton
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
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
        CMS Catálogo
      </Text>
      <Text style={{ color: colors.muted, marginBottom: 16 }}>
        Publicar, destacar e definir monetização AVOD/SVOD/TVOD — estilo Netflix Studio (ops AO).
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <TextInput
          value={catalogQuery}
          onChangeText={setCatalogQuery}
          placeholder="Pesquisar título"
          placeholderTextColor={colors.muted}
          style={inputStyle({ flex: 1, minWidth: 200, marginBottom: 0 })}
        />
        <PrimaryButton label="Pesquisar" onPress={onSearch} />
      </View>
      {titles.length === 0 ? (
        <EmptyState title="Sem títulos" />
      ) : (
        titles.map((t) => (
          <View key={t.id} style={getCardStyle()}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{t.title}</Text>
            <Text style={{ color: colors.muted }}>
              {t.kind} · {t.monetization}
              {t.rentalPriceKz != null ? ` · ${t.rentalPriceKz} Kz` : ''} ·{' '}
              {t.isPublished ? 'publicado' : 'oculto'}
              {t.isFeatured ? ' · FEATURED' : ''} · {t.workflowStatus}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <PrimaryButton
                label={t.isPublished ? 'Despublicar' : 'Publicar'}
                onPress={() =>
                  run(`cat-p-${t.id}`, () =>
                    patchCatalog(t.id, {
                      isPublished: !t.isPublished,
                      workflowStatus: !t.isPublished ? 'published' : 'archived',
                    })
                  )
                }
              />
              <PrimaryButton
                label={t.isFeatured ? 'Remover destaque' : 'Destacar'}
                variant="outline"
                onPress={() =>
                  run(`cat-f-${t.id}`, () => patchCatalog(t.id, { isFeatured: !t.isFeatured }))
                }
              />
              <PrimaryButton
                label="AVOD"
                variant="outline"
                onPress={() =>
                  run(`cat-a-${t.id}`, () =>
                    patchCatalog(t.id, { monetization: 'avod', rentalPriceKz: null })
                  )
                }
              />
              <PrimaryButton
                label="SVOD"
                variant="outline"
                onPress={() =>
                  run(`cat-s-${t.id}`, () =>
                    patchCatalog(t.id, { monetization: 'svod', rentalPriceKz: null })
                  )
                }
              />
              <PrimaryButton
                label="TVOD 1500"
                variant="outline"
                onPress={() =>
                  run(`cat-t-${t.id}`, () =>
                    patchCatalog(t.id, { monetization: 'tvod', rentalPriceKz: 1500 })
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

export function ReportsTab({ reports, run }) {
  return (
    <View>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
        Denúncias / Trust & Safety
      </Text>
      <Text style={{ color: colors.muted, marginBottom: 16 }}>
        Fila de reports de conteúdo — equivalente Netflix Trust & Safety (ops).
      </Text>
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
              <PrimaryButton
                label="Resolver"
                onPress={() =>
                  run(`rep-${r.id}`, () =>
                    reviewReport(r.id, { status: 'resolved', notes: 'Revisado' })
                  )
                }
              />
              <PrimaryButton
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
