import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, FieldLabel } from '../components/ui';
import { LoadingState, EmptyState, ErrorState } from '../components/StateViews';
import { colors, layout } from '../theme/tokens';
import {
  fetchCompanyPortal,
  registerCompany,
  addCompanyMember,
  removeCompanyMember,
} from '../services/company';

const ROLE_LABEL = {
  owner: 'Owner',
  manager: 'Manager',
  editor: 'Editor',
  finance: 'Finance',
};

export default function CompanyPortal({ onBack }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('editor');

  const load = useCallback(async () => {
    try {
      setError('');
      setData(await fetchCompanyPortal());
    } catch (err) {
      setError(err.message || 'Falha ao carregar a produtora');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <LoadingState />
      </View>
    );
  }

  const company = data?.company;
  const canManage = data?.role === 'owner' || data?.role === 'manager';
  const canFinance = data?.role === 'owner' || data?.role === 'finance' || data?.role === 'manager';

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          padding: isCompact ? 16 : 32,
          maxWidth: layout.maxContentWidth,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 80,
        }}
      >
        <Pressable
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={{ color: colors.textSecondary }}>Voltar</Text>
        </Pressable>

        <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }}>
          COMPANY PORTAL
        </Text>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
          Produtora
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 24, lineHeight: 22 }}>
          Equipa, catálogo da empresa e financeiro. Publicação continua a exigir revisão MinhaTela.
        </Text>

        {error ? <ErrorState message={error} onRetry={load} /> : null}

        {!company ? (
          <View
            style={{
              backgroundColor: '#111',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              borderTopWidth: 3,
              borderTopColor: colors.gold,
              padding: 20,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
              Registar produtora
            </Text>
            <FieldLabel>Nome da empresa</FieldLabel>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: ABC Filmes"
              placeholderTextColor={colors.muted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                padding: 10,
                borderRadius: 4,
                marginBottom: 12,
              }}
            />
            <PrimaryButton
              label="Criar produtora"
              variant="gold"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                setError('');
                try {
                  await registerCompany({ name });
                  await load();
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        ) : (
          <>
            <View
              style={{
                backgroundColor: '#111',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 18,
                marginBottom: 18,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{company.name}</Text>
              <Text style={{ color: colors.gold, marginTop: 4 }}>
                {ROLE_LABEL[data.role] || data.role} · {company.status}
              </Text>
            </View>

            {canFinance && data.finance ? (
              <View
                style={{
                  backgroundColor: '#111',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  marginBottom: 18,
                }}
              >
                <Text style={{ color: colors.muted, letterSpacing: 1, fontSize: 12 }}>RECEITA</Text>
                <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
                  {Number(data.finance.revenueKz || 0).toLocaleString('pt-AO')} Kz
                </Text>
              </View>
            ) : null}

            {canManage ? (
              <View
                style={{
                  backgroundColor: '#111',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  marginBottom: 18,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 10 }}>Equipa</Text>
                <FieldLabel>Email do membro</FieldLabel>
                <TextInput
                  value={memberEmail}
                  onChangeText={setMemberEmail}
                  autoCapitalize="none"
                  placeholder="email@exemplo.com"
                  placeholderTextColor={colors.muted}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    color: colors.text,
                    padding: 10,
                    borderRadius: 4,
                    marginBottom: 10,
                  }}
                />
                <FieldLabel>Função (owner / manager / editor / finance)</FieldLabel>
                <TextInput
                  value={memberRole}
                  onChangeText={setMemberRole}
                  autoCapitalize="none"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    color: colors.text,
                    padding: 10,
                    borderRadius: 4,
                    marginBottom: 10,
                  }}
                />
                <PrimaryButton
                  label="Adicionar membro"
                  loading={busy}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      await addCompanyMember({ email: memberEmail, role: memberRole });
                      setMemberEmail('');
                      await load();
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </View>
            ) : null}

            {(data.members || []).map((m) => (
              <View
                key={m.userId}
                style={{
                  backgroundColor: '#111',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 14,
                  marginBottom: 8,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{m.fullName}</Text>
                  <Text style={{ color: colors.muted }}>{m.email} · {ROLE_LABEL[m.role] || m.role}</Text>
                </View>
                {data.role === 'owner' && m.role !== 'owner' ? (
                  <PrimaryButton
                    label="Remover"
                    variant="outline"
                    onPress={async () => {
                      try {
                        await removeCompanyMember(m.userId);
                        await load();
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  />
                ) : null}
              </View>
            ))}

            <Text style={{ color: colors.gold, marginTop: 20, marginBottom: 10, fontWeight: '700' }}>
              Conteúdos da empresa
            </Text>
            {data.role === 'finance' ? (
              <Text style={{ color: colors.muted }}>Finance não edita catálogo.</Text>
            ) : (data.contents || []).length === 0 ? (
              <EmptyState title="Sem conteúdos da produtora" />
            ) : (
              data.contents.map((c) => (
                <View
                  key={c.id}
                  style={{
                    backgroundColor: '#111',
                    padding: 14,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{c.title}</Text>
                  <Text style={{ color: colors.muted }}>
                    {c.workflowStatus} · {c.monetization}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
