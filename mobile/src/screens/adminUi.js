import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { PrimaryButton } from '../components/ui';
import Focusable from '../tv/Focusable';
import { auditTitle, entityLabel } from './adminCopy';

export function AdminButton(props) {
  return <PrimaryButton compact {...props} />;
}

export function ActionRow({ children }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
      {children}
    </View>
  );
}

export function AdminErrorBanner({ message, onRetry, onDismiss }) {
  if (!message) return null;
  return (
    <View
      style={{
        marginBottom: 16,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(206,17,38,0.45)',
        backgroundColor: 'rgba(206,17,38,0.12)',
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#F87171', fontWeight: '700', fontSize: 13 }}>{message}</Text>
      </View>
      {onRetry ? (
        <Pressable onPress={onRetry}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Repetir</Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable onPress={onDismiss}>
          <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 12 }}>Fechar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const NAV_GROUPS = [
  {
    id: 'ops',
    label: 'Operações',
    items: [
      { id: 'overview', label: 'Painel', icon: 'grid-outline' },
      { id: 'payments', label: 'Pagamentos', icon: 'card-outline' },
      { id: 'support', label: 'Atendimento', icon: 'headset-outline' },
      { id: 'moderation', label: 'Moderação', icon: 'shield-checkmark-outline' },
      { id: 'live', label: 'Streams live', icon: 'radio-outline' },
    ],
  },
  {
    id: 'catalog',
    label: 'Catálogo',
    items: [
      { id: 'cms', label: 'Títulos', icon: 'film-outline' },
      { id: 'editorial', label: 'Editorial', icon: 'albums-outline' },
      { id: 'catalog', label: 'Ofertas e estreias', icon: 'gift-outline' },
      { id: 'uploads', label: 'Ficheiros', icon: 'cloud-upload-outline' },
    ],
  },
  {
    id: 'commerce',
    label: 'Comercial',
    items: [
      { id: 'plans', label: 'Planos', icon: 'pricetags-outline' },
      { id: 'promos', label: 'Promos', icon: 'pricetag-outline' },
      { id: 'leads', label: 'Leads', icon: 'mail-outline' },
      { id: 'ads', label: 'Anúncios', icon: 'megaphone-outline' },
    ],
  },
  {
    id: 'identity',
    label: 'Identidade',
    items: [{ id: 'users', label: 'Utilizadores', icon: 'people-outline' }],
  },
  {
    id: 'mediaops',
    label: 'Media',
    items: [{ id: 'media', label: 'Vídeo e qualidade', icon: 'cloud-outline' }],
  },
  {
    id: 'gov',
    label: 'Governação',
    items: [
      { id: 'rights', label: 'Direitos', icon: 'ribbon-outline' },
      { id: 'acquisition', label: 'Aquisição', icon: 'briefcase-outline' },
      { id: 'reports', label: 'Denúncias', icon: 'warning-outline' },
      { id: 'audit', label: 'Auditoria', icon: 'document-text-outline' },
    ],
  },
  {
    id: 'platform',
    label: 'Plataforma',
    superOnly: true,
    items: [
      { id: 'landing', label: 'Página de entrada', icon: 'color-palette-outline', superOnly: true },
      { id: 'config', label: 'Marca e textos', icon: 'text-outline', superOnly: true },
      { id: 'flags', label: 'Funcionalidades', icon: 'toggle-outline', superOnly: true },
      { id: 'tenants', label: 'Mercados', icon: 'globe-outline', superOnly: true },
      { id: 'connections', label: 'Ligações', icon: 'link-outline', superOnly: true },
    ],
  },
];

const ROLE_TABS = {
  finance_manager: ['overview', 'payments'],
  support_agent: ['overview', 'support'],
  moderator: ['overview', 'moderation', 'reports'],
  content_manager: [
    'overview',
    'cms',
    'editorial',
    'catalog',
    'uploads',
    'media',
    'rights',
    'acquisition',
  ],
};

export function navGroupsForUser(user) {
  const roles = user?.roles || [];
  const isSuper = roles.includes('super_admin');
  const isFullAdmin = isSuper || roles.includes('admin') || Boolean(user?.isAdmin);
  const allowed = new Set();
  if (!isFullAdmin) {
    for (const role of roles) {
      const tabs = ROLE_TABS[role];
      if (tabs) tabs.forEach((id) => allowed.add(id));
    }
    if (!allowed.size) allowed.add('overview');
  }
  return NAV_GROUPS.map((group) => {
    if (group.superOnly && !isSuper) return null;
    const items = group.items.filter((item) => {
      if (item.superOnly && !isSuper) return false;
      if (isFullAdmin) return true;
      return allowed.has(item.id);
    });
    if (!items.length) return null;
    return { ...group, items };
  }).filter(Boolean);
}

export const TAB_META = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((item) => [item.id, { ...item, group: g.label }]))
);

function badgeTones() {
  const light = colors.id === 'light';
  return {
    success: { bg: 'rgba(34,197,94,0.14)', fg: light ? '#15803D' : '#4ADE80', bd: 'rgba(34,197,94,0.35)' },
    warning: { bg: 'rgba(247,212,23,0.16)', fg: colors.gold, bd: 'rgba(247,212,23,0.35)' },
    danger: { bg: 'rgba(206,17,38,0.14)', fg: light ? '#B91C1C' : '#F87171', bd: 'rgba(206,17,38,0.4)' },
    info: {
      bg: light ? 'rgba(24,24,27,0.06)' : 'rgba(255,255,255,0.06)',
      fg: colors.textSecondary,
      bd: colors.border,
    },
    gold: { bg: 'rgba(247,212,23,0.16)', fg: colors.gold, bd: 'rgba(247,212,23,0.4)' },
  };
}

export function toneForStatus(status) {
  const s = String(status || '').toLowerCase();
  if (['active', 'published', 'pago', 'paid', 'resolved', 'executed', 'premium_active'].includes(s)) {
    return 'success';
  }
  if (['pending', 'pending_review', 'submitted', 'pendente', 'invited'].includes(s)) {
    return 'warning';
  }
  if (['suspended', 'rejected', 'rejeitado', 'failed', 'revoked'].includes(s)) {
    return 'danger';
  }
  return 'info';
}

export function StatusBadge({ tone = 'info', children }) {
  const tones = badgeTones();
  const t = tones[tone] || tones.info;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: t.bg,
        borderWidth: 1,
        borderColor: t.bd,
      }}
    >
      <Text style={{ color: t.fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>
        {children}
      </Text>
    </View>
  );
}

export function PageHeader({ title, subtitle, extra, compact }) {
  return (
    <View
      style={{
        marginBottom: compact ? 16 : 20,
        paddingBottom: compact ? 0 : 16,
        borderBottomWidth: compact ? 0 : 1,
        borderBottomColor: colors.border,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'flex-end',
      }}
    >
      <View style={{ flex: 1, minWidth: 200 }}>
        {title ? (
          <Text style={{ color: colors.text, fontSize: compact ? 20 : 22, fontWeight: '800' }}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text
            style={{
              color: colors.textSecondary,
              marginTop: title ? 6 : 0,
              fontSize: 14,
              lineHeight: 20,
              maxWidth: 640,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {extra ? <View style={{ flexShrink: 0 }}>{extra}</View> : null}
    </View>
  );
}

export function AdminTopBar({
  onBack,
  group,
  title,
  roleLabel,
  email,
  refreshedAt,
  attention,
  compact,
}) {
  const { themeId, toggleTheme } = useTheme();
  const envLabel =
    typeof __DEV__ !== 'undefined' && __DEV__ ? (compact ? 'Dev' : 'Desenvolvimento') : compact ? 'Prod' : 'Produção';
  const envTone = typeof __DEV__ !== 'undefined' && __DEV__ ? 'warning' : 'success';
  return (
    <View
      style={{
        minHeight: 64,
        paddingHorizontal: compact ? 12 : 20,
        paddingVertical: compact ? 10 : 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
        gap: compact ? 8 : 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 10 : 14 }}>
        <Focusable id="admin-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Focusable>
        <View style={{ flex: 1, minWidth: 0 }}>
          {compact ? null : (
            <Text
              style={{ color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}
              numberOfLines={1}
            >
              {group}
            </Text>
          )}
          <Text style={{ color: colors.text, fontSize: compact ? 16 : 17, fontWeight: '800' }} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {attention > 0 ? (
            <View
              style={{
                backgroundColor: colors.gold,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: '#111', fontWeight: '800', fontSize: 11 }}>{attention}</Text>
            </View>
          ) : null}
          <Focusable id="admin-theme" onPress={toggleTheme}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.elevated,
              }}
            >
              <Ionicons
                name={themeId === 'light' ? 'moon-outline' : 'sunny-outline'}
                size={16}
                color={colors.text}
              />
            </View>
          </Focusable>
          <StatusBadge tone="gold">{roleLabel}</StatusBadge>
          <StatusBadge tone={envTone}>{envLabel}</StatusBadge>
        </View>
        {compact ? null : (
          <View style={{ alignItems: 'flex-end', minWidth: 140, maxWidth: 240 }}>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
              {email || '—'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
              {refreshedAt ? formatWhen(refreshedAt) : 'A sincronizar…'}
            </Text>
          </View>
        )}
      </View>
      {compact ? (
        <Text style={{ color: colors.muted, fontSize: 11, paddingLeft: 34 }} numberOfLines={1}>
          {email || '—'}
          {refreshedAt ? ` · ${formatWhen(refreshedAt)}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

export function cardStyle() {
  return {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  };
}

export function inputStyle(extra = {}) {
  return {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 6,
    marginBottom: 10,
    ...extra,
  };
}

export function SectionTitle({ children }) {
  return (
    <Text
      style={{
        color: colors.muted,
        fontWeight: '800',
        letterSpacing: 1.4,
        fontSize: 11,
        marginTop: 18,
        marginBottom: 12,
      }}
    >
      {String(children).toUpperCase()}
    </Text>
  );
}

export function KpiCard({ label, value, hint, tone }) {
  const accent =
    tone === 'danger' ? colors.red : tone === 'warning' ? colors.gold : tone === 'success' ? colors.success : colors.red;
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 160,
        minWidth: 156,
        backgroundColor: colors.elevated,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: accent,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.8, fontWeight: '700' }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 8 }}>{value}</Text>
      {hint ? (
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function QueueChip({ label, count, onPress }) {
  const hot = count > 0;
  return (
    <Focusable
      id={`queue-${label}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: hot ? 'rgba(247,212,23,0.45)' : colors.border,
        backgroundColor: hot ? 'rgba(247,212,23,0.07)' : colors.elevated,
        marginRight: 10,
        marginBottom: 10,
        minWidth: 148,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, marginTop: 2 }}>{count}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={hot ? colors.gold : colors.muted} />
    </Focusable>
  );
}

export function AuditRow({ item }) {
  const title = item.title || auditTitle(item.action);
  const who = item.actor?.name || item.actor?.email || '';
  const what = item.entityLabel || entityLabel(item.entity);
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        alignItems: 'flex-start',
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.red,
          marginTop: 6,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
          {[what, who].filter(Boolean).join(' · ')}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
          {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-AO') : '—'}
        </Text>
      </View>
    </View>
  );
}

export function NavItem({ item, active, onPress }) {
  return (
    <Focusable
      id={`tab-${item.id}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 6,
        backgroundColor: active ? 'rgba(206,17,38,0.16)' : 'transparent',
        borderWidth: 1,
        borderColor: active ? 'rgba(206,17,38,0.45)' : 'transparent',
        marginBottom: 2,
      }}
    >
      <Ionicons name={item.icon} size={16} color={active ? colors.text : colors.muted} />
      <Text
        style={{
          color: active ? colors.text : colors.textSecondary,
          fontWeight: active ? '800' : '600',
          fontSize: 13,
          flex: 1,
        }}
      >
        {item.label}
      </Text>
    </Focusable>
  );
}

export function AdminSidebar({ tab, onChange, attention, groups = NAV_GROUPS }) {
  return (
    <View
      style={{
        width: 248,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          minHeight: 64,
          paddingHorizontal: 16,
          justifyContent: 'center',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ color: colors.red, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 }}>
          MINHATELA
        </Text>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
          Console empresa
        </Text>
      </View>
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 32 }}>
      {attention > 0 ? (
        <View
          style={{
            ...cardStyle(),
            padding: 12,
            backgroundColor: 'rgba(247,212,23,0.08)',
            borderColor: 'rgba(247,212,23,0.3)',
          }}
        >
          <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 12 }}>Fila operacional</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{attention}</Text>
        </View>
      ) : null}
      {groups.map((group) => (
        <View key={group.id} style={{ marginBottom: 16 }}>
          <Text
            style={{
              color: colors.muted,
              fontSize: 10,
              fontWeight: '800',
              letterSpacing: 1.5,
              marginBottom: 6,
              marginTop: 4,
            }}
          >
            {group.label.toUpperCase()}
          </Text>
          {group.items.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              active={tab === item.id}
              onPress={() => onChange(item.id)}
            />
          ))}
        </View>
      ))}
    </ScrollView>
    </View>
  );
}

export function AdminMobileNav({ tab, onChange, groups = NAV_GROUPS }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }}
      style={{ borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0 }}
    >
      {groups.map((group, gi) => (
        <View
          key={group.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: 10,
            paddingRight: gi === groups.length - 1 ? 0 : 10,
            borderRightWidth: gi === groups.length - 1 ? 0 : 1,
            borderRightColor: colors.border,
          }}
        >
          {group.items.map((item) => {
            const active = tab === item.id;
            return (
              <Focusable
                key={item.id}
                id={`mtab-${item.id}`}
                onPress={() => onChange(item.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: active ? colors.text : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? colors.text : colors.border,
                  marginRight: 6,
                }}
              >
                <Ionicons name={item.icon} size={14} color={active ? colors.black : colors.textSecondary} />
                <Text
                  style={{
                    color: active ? colors.black : colors.textSecondary,
                    fontWeight: '700',
                    fontSize: 12,
                  }}
                >
                  {item.label}
                </Text>
              </Focusable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

export function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-AO');
  } catch {
    return String(value);
  }
}
