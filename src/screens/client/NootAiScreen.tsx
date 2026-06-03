import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Send, Sparkles, Brain, Trash2 } from 'lucide-react-native';
import { supabase } from '../../utils/supabase';
import { getLinkedProfileForCurrentUser } from '../../utils/authProfile';
import { ThemeContext } from '../../navigation/navigationTypes';
import PremiumLoader from '../../components/PremiumLoader';
import { PremiumAlert } from '../../services/PremiumAlertService';

const formatCurrency = (val: number | string) => {
  return '₱' + Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

interface Message {
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
}

// Module-level array to persist request timestamps across component unmounts
let globalRequestTimestamps: number[] = [];

// Client-side safety filters to catch prompt injection, secret leaking requests, and jailbreaks
function checkInputSafety(input: string): { isSafe: boolean; reason: string } {
  const lowerInput = input.toLowerCase();

  // 1. Detect attempts to access environment variables or secrets
  const secretKeywords = [
    'api_key', 'apikey', 'secret', 'password', 'token', 'credential', 
    '.env', 'process.env', 'private key', 'access_key', 'accesskey'
  ];
  if (secretKeywords.some(keyword => lowerInput.includes(keyword))) {
    return { 
      isSafe: false, 
      reason: 'I cannot access or share credentials, secrets, or environment configuration files.' 
    };
  }

  // 2. Detect common prompt injection / system prompt extraction patterns
  const injectionKeywords = [
    'system prompt', 'system instruction', 'reveal your instructions', 
    'ignore previous', 'ignore the instructions', 'bypass instructions', 
    'new rules', 'you are now a', 'dev mode', 'developer mode', 'jailbreak',
    'output your prompt', 'print your prompt', 'show your instructions',
    'forget your instructions'
  ];
  if (injectionKeywords.some(keyword => lowerInput.includes(keyword))) {
    return { 
      isSafe: false, 
      reason: 'I am programmed to only assist with S-Pay finances. I cannot share my system instructions or override my core rules.' 
    };
  }

  // 3. Detect requests for code, scripts, programming, or database injection
  const codeKeywords = [
    'python', 'javascript', 'typescript', 'c++', 'java', 'rust', 'golang', 
    'write a script', 'write code', 'coding', 'programming', 'code script',
    'bash script', 'powershell', 'sql query', 'html code', 'css style',
    'function in', 'class in', 'develop a', 'program a'
  ];
  if (codeKeywords.some(keyword => lowerInput.includes(keyword))) {
    return { 
      isSafe: false, 
      reason: 'I am programmed to only assist with S-Pay personal finances. I cannot write, generate, or review programming code or scripts.' 
    };
  }

  return { isSafe: true, reason: '' };
}

function checkOutputSafety(output: string): string {
  // Redact Gemini API keys
  const geminiKeyRegex = /AIzaSy[A-Za-z0-9_-]{33}/g;
  let sanitized = output.replace(geminiKeyRegex, '[REDACTED_API_KEY]');
  
  // Redact process.env references
  sanitized = sanitized.replace(/process\.env\.[A-Za-z0-9_]+/gi, '[REDACTED_ENV]');
  
  // Bypass check if it is the local developer API key warning
  if (sanitized.includes('GEMINI_API_KEY environment variable is not defined')) {
    return sanitized;
  }

  // Detect code blocks (Markdown code fences) indicating script generation
  if (sanitized.includes('```')) {
    return 'I apologize, but I am programmed to only assist with S-Pay finances. I cannot generate programming code or scripts.';
  }

  // Detect raw context blocks
  if (
    sanitized.includes('Client Name:') && 
    sanitized.includes('Active Credit Limit:') && 
    sanitized.includes('Active Orders:') && 
    sanitized.includes('Budget Settings:')
  ) {
    return 'I apologize, but I cannot display the raw system context data. Please let me know what specific information about S-Pay you are looking for!';
  }
  
  return sanitized;
}

const getApiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return 'https://nootspaytracker.vercel.app';
};

// Formats Markdown-style responses into React Native text elements inline
function renderFormattedMessage(text: string, t: any) {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    if (!line.trim()) {
      return <View key={index} style={{ height: 4 }} />;
    }

    if (line.trim() === '---') {
      return <View key={index} style={{ height: 1, backgroundColor: t.cardBorder, marginVertical: 8 }} />;
    }

    let isBullet = false;
    let isNestedBullet = false;
    let isHeader = false;
    let headerLevel = 0;
    let cleanLine = line;

    if (line.startsWith('### ')) {
      isHeader = true;
      headerLevel = 3;
      cleanLine = line.substring(4);
    } else if (line.startsWith('## ')) {
      isHeader = true;
      headerLevel = 2;
      cleanLine = line.substring(3);
    } else if (line.startsWith('# ')) {
      isHeader = true;
      headerLevel = 1;
      cleanLine = line.substring(2);
    } else if (line.startsWith('  - ') || line.startsWith('    - ')) {
      isNestedBullet = true;
      cleanLine = line.trim().substring(2);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      isBullet = true;
      cleanLine = line.substring(2);
    }

    // Process bold tags (**bold**) within the line
    const parts = cleanLine.split('**');
    const formattedContent = parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <Text key={i} style={{ fontWeight: 'bold', color: t.textPrimary }}>
            {part}
          </Text>
        );
      }
      return part;
    });

    if (isHeader) {
      let fontSize = 13;
      if (headerLevel === 1) fontSize = 16;
      if (headerLevel === 2) fontSize = 14;
      return (
        <Text key={index} style={{ fontSize, fontWeight: 'bold', color: t.accent, marginTop: 8, marginBottom: 4 }}>
          {formattedContent}
        </Text>
      );
    }

    if (isNestedBullet) {
      return (
        <View key={index} style={{ flexDirection: 'row', paddingLeft: 16, marginVertical: 1 }}>
          <Text style={{ color: t.accent, marginRight: 6 }}>•</Text>
          <Text style={{ flex: 1, fontSize: 13, color: t.textSecondary, lineHeight: 18 }}>
            {formattedContent}
          </Text>
        </View>
      );
    }

    if (isBullet) {
      return (
        <View key={index} style={{ flexDirection: 'row', paddingLeft: 8, marginVertical: 2 }}>
          <Text style={{ color: t.accent, marginRight: 6 }}>•</Text>
          <Text style={{ flex: 1, fontSize: 13, color: t.textPrimary, lineHeight: 18 }}>
            {formattedContent}
          </Text>
        </View>
      );
    }

    return (
      <Text key={index} style={{ fontSize: 13, color: t.textPrimary, lineHeight: 19, marginBottom: 2 }}>
        {formattedContent}
      </Text>
    );
  });
}

export default function NootAiScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useContext(ThemeContext);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User variables computed from database
  const [userName, setUserName] = useState('Client');
  const [financialMetrics, setFinancialMetrics] = useState({
    healthScore: 100,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchNootAiMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const { user, profile, profileId } = await getLinkedProfileForCurrentUser();
      if (!user) {
        setDemoParams('Client Guest');
        return;
      }

      const profileName = profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Client User';

      // Fetch orders to compute health score
      const { data: dbOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', profileId);

      if (ordersError) throw ordersError;

      if (!dbOrders || dbOrders.length === 0) {
        setDemoParams(profileName);
        return;
      }

      const orderIds = dbOrders.map(o => o.id);
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('due_date, is_paid, payment_date')
        .in('order_id', orderIds);

      if (paymentsError) throw paymentsError;

      // Calculate health score matching web
      let totalCompletedCount = 0;
      let onTimeCount = 0;
      let totalDaysLate = 0;

      (paymentsData || []).forEach(p => {
        if (p.is_paid) {
          totalCompletedCount++;
          if (p.payment_date && p.due_date) {
            const payTime = new Date(p.payment_date).getTime();
            const dueTime = new Date(p.due_date).getTime();
            if (payTime <= dueTime) {
              onTimeCount++;
            } else {
              const daysLate = Math.ceil((payTime - dueTime) / (1000 * 60 * 60 * 24));
              totalDaysLate += Math.max(0, daysLate);
            }
          } else {
            onTimeCount++;
          }
        }
      });

      const onTimeRate = totalCompletedCount > 0 ? (onTimeCount / totalCompletedCount) * 105 : 100;
      const actualOnTimeRate = Math.min(100, onTimeRate);
      const avgDaysLate = (totalCompletedCount - onTimeCount) > 0 ? totalDaysLate / (totalCompletedCount - onTimeCount) : 0;
      const healthScore = Math.min(100, Math.max(0, Math.round(actualOnTimeRate - (avgDaysLate * 2))));

      setUserName(profileName);
      setFinancialMetrics({ healthScore });
      initializeChat(profileName, healthScore);
    } catch (e: any) {
      console.warn('[NootAiScreen] Data fetch issues, defaulting to demo parameters:', e);
      setDemoParams('Client User');
    } finally {
      setLoading(false);
    }
  };

  const setDemoParams = (name: string) => {
    setUserName(name);
    setFinancialMetrics({ healthScore: 92 });
    initializeChat(name, 92);
  };

  const initializeChat = (name: string, score: number) => {
    const firstName = name.split(' ')[0];
    setMessages([
      {
        sender: 'ai',
        text: `Hello! I am NootAI, your premium financial companion. I can help analyze your credit limit, installment status, and budget allocations. What would you like to check today?`,
        timestamp: new Date(),
      }
    ]);
  };

  useEffect(() => {
    fetchNootAiMetrics();
  }, []);

  // Sliding window rate limiter identical to web version
  const checkRateLimit = (): { isRateLimited: boolean; reason: string } => {
    const NOW = Date.now();
    const LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
    const MAX_REQUESTS = 5; // Allow maximum of 5 requests per minute
    const MIN_COOLDOWN_MS = 3000; // 3 seconds cooldown between messages

    // Filter out timestamps older than the 1-minute window
    const validTimestamps = globalRequestTimestamps.filter(t => NOW - t < LIMIT_WINDOW_MS);

    // Check 3-second cooldown between consecutive messages
    if (validTimestamps.length > 0) {
      const lastRequest = validTimestamps[validTimestamps.length - 1];
      if (NOW - lastRequest < MIN_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((MIN_COOLDOWN_MS - (NOW - lastRequest)) / 1000);
        return {
          isRateLimited: true,
          reason: `Please wait ${waitSeconds}s before sending another message.`,
        };
      }
    }

    // Check overall request frequency limit
    if (validTimestamps.length >= MAX_REQUESTS) {
      const oldestRequest = validTimestamps[0];
      const waitSeconds = Math.ceil((LIMIT_WINDOW_MS - (NOW - oldestRequest)) / 1000);
      return {
        isRateLimited: true,
        reason: `Rate limit exceeded. Please try again in ${waitSeconds} seconds.`,
      };
    }

    // Record the current safe request timestamp
    validTimestamps.push(NOW);
    globalRequestTimestamps = validTimestamps;
    return { isRateLimited: false, reason: '' };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || userInput).trim();
    if (!text || isAiTyping) return;

    const userMsg: Message = { sender: 'user', text, timestamp: new Date() };

    // 1. Run Pre-Input Safety Check
    const safetyCheck = checkInputSafety(text);
    if (!safetyCheck.isSafe) {
      setMessages(prev => [
        ...prev,
        userMsg,
        { sender: 'ai', text: safetyCheck.reason, timestamp: new Date() }
      ]);
      if (!textToSend) setUserInput('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
      return;
    }

    // 2. Run Rate Limiting Check
    const rateLimitCheck = checkRateLimit();
    if (rateLimitCheck.isRateLimited) {
      setMessages(prev => [
        ...prev,
        { sender: 'ai', text: `⚠️ ${rateLimitCheck.reason}`, timestamp: new Date() }
      ]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
      return;
    }

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setUserInput('');
    setIsAiTyping(true);

    // Scroll to bottom
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);

    // 3. Fetch from backend API
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = getApiUrl();

      const response = await fetch(`${apiUrl}/api/nootai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();
      if (data.success) {
        // 4. Run Post-Output Safety Check on AI response
        const safeResponse = checkOutputSafety(data.response);
        setMessages(prev => [...prev, { sender: 'ai', text: safeResponse, timestamp: new Date() }]);
      } else {
        throw new Error(data.error || 'Server error');
      }
    } catch (e: any) {
      console.warn('[NootAiScreen] Backend error:', e);
      const errMsg = e?.message || '';
      const displayMsg = errMsg.includes('Rate limit') || errMsg.includes('limit') || errMsg.includes('safeguard')
        ? errMsg
        : 'I apologize, but I am currently offline. Please check your network connection.';
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: displayMsg,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsAiTyping(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const handleSuggestionPress = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleClearHistory = () => {
    PremiumAlert.alert(
      'Clear History',
      'Are you sure you want to clear the conversation history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setMessages([
              {
                sender: 'ai',
                text: 'Hello! I am NootAI, your premium financial companion. I can help analyze your credit limit, installment status, and budget allocations. What would you like to check today?',
                timestamp: new Date(),
              }
            ]);
          }
        }
      ]
    );
  };

  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f8fafc',
    headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
    headerBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#223049' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    accent: '#ee4d2d',
    accentLight: 'rgba(238, 77, 45, 0.08)',
    inputBg: isDarkMode ? '#0f172a' : '#f1f5f9',
    inputBorder: isDarkMode ? '#223049' : '#cbd5e1',
    chatBubbleUser: '#ee4d2d',
    chatBubbleAi: isDarkMode ? '#161c2a' : '#ffffff',
    chatBubbleAiBorder: isDarkMode ? '#223049' : '#cbd5e1',
  };

  if (loading) {
    return (
      <PremiumLoader
        title="NootAI Assistant"
        subtitle="Analyzing financial health indices and syncing limits..."
        error={error}
        onRetry={fetchNootAiMetrics}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {/* Header Bar */}
      <View style={[styles.headerBar, { backgroundColor: t.headerBg, borderBottomColor: t.headerBorder }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          style={[styles.backBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
        >
          <ArrowLeft size={18} color={t.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: t.textPrimary }]}>NootAI Assistant</Text>
          <Text style={styles.headerSubtitle}>Personal Financial Coach</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={handleClearHistory}
            activeOpacity={0.85}
            style={[styles.backBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9', width: 32, height: 32, borderRadius: 8 }]}
          >
            <Trash2 size={16} color={t.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.badgeFrame, { backgroundColor: t.accentLight }]}>
            <Brain size={12} color={t.accent} />
            <Text style={[styles.badgeText, { color: t.accent }]}>Active Models</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {/* Messages list */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, index) => {
            const isAi = msg.sender === 'ai';
            return (
              <View key={index} style={[styles.messageRow, isAi ? styles.rowAi : styles.rowUser]}>
                {isAi && (
                  <View style={[styles.avatarBox, { backgroundColor: t.accentLight, borderColor: t.accent + '20' }]}>
                    <Brain size={15} color={t.accent} />
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    isAi
                      ? [styles.bubbleAi, { backgroundColor: t.chatBubbleAi, borderColor: t.chatBubbleAiBorder }]
                      : [styles.bubbleUser, { backgroundColor: t.chatBubbleUser }],
                  ]}
                >
                  <View style={styles.bubbleTextContainer}>
                    {isAi ? renderFormattedMessage(msg.text, t) : (
                      <Text style={[styles.bubbleText, { color: '#ffffff' }]}>
                        {msg.text}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          {isAiTyping && (
            <View style={[styles.messageRow, styles.rowAi]}>
              <View style={[styles.avatarBox, { backgroundColor: t.accentLight }]}>
                <Brain size={15} color={t.accent} />
              </View>
              <View style={[styles.bubble, styles.bubbleAi, { backgroundColor: t.chatBubbleAi, borderColor: t.chatBubbleAiBorder, height: 42, justifyContent: 'center' }]}>
                <ActivityIndicator size="small" color={t.accent} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick Helper Prompts */}
        {messages.length === 1 && (
          <View style={styles.suggestionsContainer}>
            {[
              'Check my available credit',
              'Am I on track with my budgets?',
              'Show my next installment due date',
            ].map((prompt, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => handleSuggestionPress(prompt)}
                activeOpacity={0.85}
                style={[styles.suggestionChip, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
              >
                <Brain size={11} color={t.accent} />
                <Text style={[styles.suggestionText, { color: t.textSecondary }]}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input area */}
        <View style={[styles.inputContainer, { backgroundColor: t.headerBg, borderTopColor: t.headerBorder }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
            placeholder="Ask me anything about your installments..."
            placeholderTextColor={isDarkMode ? 'rgba(148, 163, 184, 0.4)' : '#94a3b8'}
            value={userInput}
            onChangeText={setUserInput}
            onSubmitEditing={() => handleSendMessage()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: t.accent }]}
            onPress={() => handleSendMessage()}
            activeOpacity={0.85}
          >
            <Send size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
    fontFamily: 'Jakarta-Medium',
  },
  badgeFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
  },
  keyboardContainer: {
    flex: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 4,
    maxWidth: '85%',
  },
  rowAi: {
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  avatarBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleAi: {
    borderTopLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleTextContainer: {
    maxWidth: '100%',
  },
  bubbleText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 19,
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  suggestionText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1.5,
    gap: 10,
  },
  textInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
