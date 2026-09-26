import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brand, layout } from '../theme/tokens';
import {
  listHelp,
  getHelpArticle,
  createSupportTicket,
  listMyTickets,
} from '../services/support';
import Focusable from '../tv/Focusable';

function MarkdownLite({ md }) {
  return (
    <View style={{ gap: 8 }}>
      {String(md || '')
        .split('\n')
        .map((line, idx) => {
          const t = line.trim();
          if (!t) return <View key={idx} style={{ height: 6 }} />;
          if (t.startsWith('# ')) {
            return (
              <Text key={idx} style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
                {t.slice(2)}
              </Text>
            );
          }
          if (t.startsWith('## ')) {
            return (
              <Text key={idx} style={{ color: colors.gold, fontSize: 16, fontWeight: '700', marginTop: 8 }}>
                {t.slice(3)}
              </Text>
            );
          }
          return (
            <Text key={idx} style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22 }}>
              {t.replace(/\*\*(.+?)\*\*/g, '$1')}
            </Text>
          );
        })}
    </View>
  );
}

export default function HelpCenter({ onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [tab, setTab] = useState('faq');
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({ subject: '', body: '', category: 'geral' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadFaq = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listHelp(category || undefined);
      setArticles(data.articles || []);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar ajuda');
    } finally {
      setLoading(false);
    }
  }, [category]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMyTickets();
      setTickets(data.tickets || []);
    } catch (err) {
      setError(err.message || 'Falha ao carregar tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'faq') loadFaq();
    else loadTickets();
  }, [tab, loadFaq, loadTickets]);

  async function openArticle(slug) {
    try {
      const article = await getHelpArticle(slug);
      setSelected(article);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitTicket() {
    setMsg('');
    try {
      const res = await createSupportTicket(form);
      setMsg(res.message || 'Ticket criado');
      setForm({ subject: '', body: '', category: 'geral' });
      setTab('tickets');
    } catch (err) {
      setMsg(err.message || 'Falha ao criar ticket');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: isCompact ? 16 : 40,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 12,
        }}
      >
        <Focusable id="help-back" onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Focusable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', flex: 1 }}>
          Centro de Ajuda
        </Text>
        <Text style={{ color: colors.red, fontWeight: '800', letterSpacing: 1 }}>
          {brand.name.toUpperCase()}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: isCompact ? 16 : 40,
          paddingVertical: 12,
        }}
      >
        {[
          { id: 'faq', label: 'FAQ' },
          { id: 'ticket', label: 'Novo pedido' },
          { id: 'tickets', label: 'Os meus tickets' },
        ].map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              setSelected(null);
              setTab(item.id);
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: tab === item.id ? colors.gold : colors.border,
              backgroundColor: tab === item.id ? 'rgba(247,212,23,0.12)' : 'transparent',
            }}
          >
            <Text
              style={{
                color: tab === item.id ? colors.gold : colors.textSecondary,
                fontWeight: '700',
                fontSize: 12,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.red} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: isCompact ? 16 : 40,
            maxWidth: layout.maxContentWidth,
            width: '100%',
            alignSelf: 'center',
            paddingBottom: 80,
          }}
        >
          {error ? <Text style={{ color: colors.red, marginBottom: 12 }}>{error}</Text> : null}
          {msg ? <Text style={{ color: colors.gold, marginBottom: 12 }}>{msg}</Text> : null}

          {tab === 'faq' && !selected ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <Pressable
                  onPress={() => setCategory(null)}
                  style={{
                    marginRight: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: !category ? colors.text : colors.border,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: !category ? colors.text : colors.muted, fontWeight: '700', fontSize: 12 }}>
                    Todos
                  </Text>
                </Pressable>
                {categories.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={{
                      marginRight: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: category === c ? colors.text : colors.border,
                      borderRadius: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: category === c ? colors.text : colors.muted,
                        fontWeight: '700',
                        fontSize: 12,
                        textTransform: 'capitalize',
                      }}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {articles.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => openArticle(a.slug)}
                  style={{
                    paddingVertical: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                      {a.category.toUpperCase()}
                    </Text>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>{a.title}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </>
          ) : null}

          {tab === 'faq' && selected ? (
            <View>
              <Pressable onPress={() => setSelected(null)} style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.gold, fontWeight: '700' }}>← Voltar à lista</Text>
              </Pressable>
              <MarkdownLite md={selected.bodyMd} />
            </View>
          ) : null}

          {tab === 'ticket' ? (
            <View style={{ gap: 12 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
                Descreva o problema. Pagamentos, playback, conta…
              </Text>
              <TextInput
                value={form.subject}
                onChangeText={(subject) => setForm((f) => ({ ...f, subject }))}
                placeholder="Assunto"
                placeholderTextColor={colors.muted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  padding: 12,
                  borderRadius: 4,
                }}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['geral', 'pagamento', 'playback', 'conta', 'conteudo'].map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setForm((f) => ({ ...f, category: c }))}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: form.category === c ? colors.gold : colors.border,
                      borderRadius: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: form.category === c ? colors.gold : colors.muted,
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={form.body}
                onChangeText={(body) => setForm((f) => ({ ...f, body }))}
                placeholder="Detalhes do pedido"
                placeholderTextColor={colors.muted}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  padding: 12,
                  borderRadius: 4,
                  minHeight: 140,
                  textAlignVertical: 'top',
                }}
              />
              <Pressable
                onPress={submitTicket}
                style={{
                  backgroundColor: colors.red,
                  paddingVertical: 14,
                  alignItems: 'center',
                  borderRadius: 4,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>Enviar pedido</Text>
              </Pressable>
            </View>
          ) : null}

          {tab === 'tickets' ? (
            tickets.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>
                Ainda não tem tickets.
              </Text>
            ) : (
              tickets.map((t) => (
                <View
                  key={t.id}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 6,
                    padding: 14,
                    marginBottom: 12,
                    backgroundColor: colors.elevated,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{t.subject}</Text>
                    <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '800' }}>
                      {t.status.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                    {t.category} · {new Date(t.createdAt).toLocaleString('pt-AO')}
                  </Text>
                  {t.adminNotes ? (
                    <Text style={{ color: colors.textSecondary, marginTop: 10 }}>
                      Resposta: {t.adminNotes}
                    </Text>
                  ) : null}
                </View>
              ))
            )
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
