import React from "react";
import AppShell from "@/layouts/AppShell";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import ChatList from "@/components/ChatList";
import RecordDetailSheet from "@/components/RecordDetailSheet";
import RecordFullDetailScreen from "@/components/RecordFullDetailScreen";
import Records from "@/pages/Records";
import { aiConversationLogEntries } from "@/data/aiConversationLog";
import { useCandidateProfile } from "@/data/candidateProfile";
import {
  createTestReplyMessage,
  demoSenderIdentityId,
  getInitialTestGroups,
  getInitialTestIdentities,
  getInitialTestMessages,
  getInitialTestReadState,
  getPrivateConversationId,
  persistTestMessages,
  persistTestReadState,
  testConversationStorageEvent,
  testGroupsStorageKey,
  testIdentitiesStorageKey,
  testMessagesStorageKey,
  testReadStateStorageKey,
  type TestConversationType,
  type TestGroup,
  type TestIdentity,
  type TestMessage,
  type TestReadState,
  type TestMessageSender,
} from "@/data/testConversations";
import { formatBubbleTime, formatTimeLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  accentColorOptions,
  getLocaleDisplayName,
  supportedLocales,
  usePreferences,
  type AccentColor,
  type AppIcon,
  type LocaleCode,
  type ResolvedTheme,
  type ThemeMode,
} from "@/settings/preferences";
import type { PageType } from "@/App";
import type { RecordItem, RecordReference, RecordSourceConversation } from "@/types/record";

type HomeProps = {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
};

type TabItem = {
  key: PageType;
};

const tabs: TabItem[] = [
  { key: "records" },
  { key: "arrangements" },
  { key: "insight" },
  { key: "mine" },
];

const aiConversationReadCountStorageKey = "arkme-demo.aiConversationReadCount";
const browserNotificationPromptedStorageKey = "arkme-demo.browserNotificationPrompted";
const createdSelfRecordsStorageKey = "arkme-demo.selfRecords";
const arrangementsStorageKey = "arkme-demo.arrangements";
const arrangementAiConfigStorageKey = "arkme-demo.arrangementAiConfig";
const searchHistoryStorageKey = "arkme-demo.searchHistory";
const aiConversationTotalCount = aiConversationLogEntries.length;
const maxSearchHistoryCount = 4;

type QuickSearchType = "image" | "audio" | "link" | "file" | "longArticle" | "contact";

type ConversationReturnContext =
  | { mode: "drawer" }
  | {
      mode: "previous";
      recordDetail: RecordItem | null;
      recordSnapshot: RecordItem | null;
    };

type TestConversationSummary = {
  conversationId: string;
  conversationType: TestConversationType;
  title: string;
  subtitle: string;
  avatarLabel: string;
  color: string;
  identity?: TestIdentity;
  group?: TestGroup;
  memberIdentities: TestIdentity[];
  records: TestConversationRecord[];
  latestMessage: TestMessage;
  latestUnreadIdentityMessage: TestMessage | null;
  unreadCount: number;
};

type TestConversationRecord = RecordItem & {
  sender: TestMessageSender;
  identityId: string;
};

type ArrangementStatus = "todo" | "expired" | "completed" | "paused";
type ArrangementKind = "task" | "schedule" | "reminder" | "note";
type ArrangementPriority = "low" | "normal" | "important" | "urgent";
type ArrangementSourceType = "manual" | "text" | "conversation";

type ArrangementChecklistItem = {
  uid: string;
  text: string;
  completed: boolean;
};

type ArrangementSource = {
  type: ArrangementSourceType;
  label: string;
  text: string;
};

type ArrangementAiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type ArrangementAiConfidence = "low" | "medium" | "high";
type ArrangementAiAction = "create" | "update" | "complete" | "merge";

type ArrangementAiRecognitionResult = {
  action: ArrangementAiAction;
  targetUid: string;
  targetUids: string[];
  title: string;
  content: string;
  kind: ArrangementKind;
  priority: ArrangementPriority;
  scheduledAt: string;
  scheduledAtText: string;
  location: string;
  participants: string[];
  tags: string[];
  completionCriteria: string;
  confidence: ArrangementAiConfidence;
  notes: string;
  optimizationSummary: string;
  rawResponse: string;
};

type ArrangementItem = {
  uid: string;
  title: string;
  content: string;
  kind: ArrangementKind;
  priority: ArrangementPriority;
  location: string;
  participants: string[];
  tags: string[];
  checklist: ArrangementChecklistItem[];
  completionCriteria: string;
  source: ArrangementSource;
  sources: ArrangementSource[];
  mergeGroupId: string | null;
  scheduledAt: number | null;
  status: ArrangementStatus;
  completedAt: number | null;
  pausedAt: number | null;
  aiAction: ArrangementAiAction | null;
  aiSummary: string;
  aiRelatedArrangementTitles: string[];
  aiProcessedAt: number | null;
  createAt: number;
  updateAt: number;
};

type HomeMessagePreview = {
  summary: TestConversationSummary;
  message: TestMessage;
  unreadCount: number;
};

const quickSearchTypes: QuickSearchType[] = [
  "image",
  "audio",
  "link",
  "file",
  "longArticle",
  "contact",
];

function getInitialAiConversationReadCount() {
  if (typeof window === "undefined") {
    return aiConversationTotalCount;
  }

  const storedValue = window.localStorage.getItem(aiConversationReadCountStorageKey);
  if (storedValue === null) {
    window.localStorage.setItem(
      aiConversationReadCountStorageKey,
      String(aiConversationTotalCount)
    );
    return aiConversationTotalCount;
  }

  const parsedValue = Number(storedValue);
  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.min(Math.max(0, parsedValue), aiConversationTotalCount);
}

function normalizeStoredSelfRecord(value: unknown): RecordItem | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Partial<RecordItem>;
  if (
    typeof record.uid !== "string" ||
    typeof record.text_content !== "string" ||
    typeof record.send_at !== "number" ||
    typeof record.create_at !== "number" ||
    typeof record.update_at !== "number" ||
    !Number.isFinite(record.send_at) ||
    !Number.isFinite(record.create_at) ||
    !Number.isFinite(record.update_at)
  ) {
    return null;
  }

  const referencedRecord = normalizeStoredRecordReference(record.referencedRecord);

  return {
    uid: record.uid,
    text_content: record.text_content,
    send_at: record.send_at,
    create_at: record.create_at,
    update_at: record.update_at,
    ...(referencedRecord ? { referencedRecord } : {}),
  };
}

function normalizeStoredRecordReference(value: unknown): RecordReference | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Partial<RecordReference>;
  if (
    typeof record.uid !== "string" ||
    typeof record.text_content !== "string" ||
    typeof record.send_at !== "number" ||
    typeof record.create_at !== "number" ||
    typeof record.update_at !== "number" ||
    !Number.isFinite(record.send_at) ||
    !Number.isFinite(record.create_at) ||
    !Number.isFinite(record.update_at)
  ) {
    return null;
  }

  return {
    uid: record.uid,
    text_content: record.text_content,
    send_at: record.send_at,
    create_at: record.create_at,
    update_at: record.update_at,
    ...(record.sourceConversation ? { sourceConversation: record.sourceConversation } : {}),
  };
}

function getInitialCreatedSelfRecords() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(createdSelfRecordsStorageKey);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .map(normalizeStoredSelfRecord)
      .filter((record): record is RecordItem => Boolean(record));
  } catch {
    return [];
  }
}

function persistCreatedSelfRecords(records: RecordItem[]) {
  if (typeof window === "undefined") return;

  const storableRecords = records.map(
    ({ uid, text_content, send_at, create_at, update_at, referencedRecord }) => ({
      uid,
      text_content,
      send_at,
      create_at,
      update_at,
      ...(referencedRecord ? { referencedRecord } : {}),
    })
  );

  try {
    window.localStorage.setItem(
      createdSelfRecordsStorageKey,
      JSON.stringify(storableRecords)
    );
  } catch {
    // Storage can be unavailable in private modes; keep the in-memory record.
  }
}

function getInitialArrangementAiConfig(): ArrangementAiConfig {
  if (typeof window === "undefined") {
    return {
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      model: "",
    };
  }

  try {
    const storedValue = window.localStorage.getItem(arrangementAiConfigStorageKey);
    if (!storedValue) {
      return {
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "",
      };
    }

    const parsedValue = JSON.parse(storedValue);
    if (!parsedValue || typeof parsedValue !== "object") {
      return {
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "",
      };
    }

    return {
      apiKey: typeof parsedValue.apiKey === "string" ? parsedValue.apiKey.trim() : "",
      baseUrl:
        typeof parsedValue.baseUrl === "string" && parsedValue.baseUrl.trim()
          ? parsedValue.baseUrl.trim()
          : "https://api.openai.com/v1",
      model: typeof parsedValue.model === "string" ? parsedValue.model.trim() : "",
    };
  } catch {
    return {
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      model: "",
    };
  }
}

function persistArrangementAiConfig(config: ArrangementAiConfig) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(arrangementAiConfigStorageKey, JSON.stringify(config));
  } catch {
    // Keep the in-memory configuration if storage is unavailable.
  }
}

function sanitizeArrangementAiToken(value: string) {
  return value.replace(/[\s\u200B-\u200D\uFEFF\u2060]/g, "");
}

function hasOnlyPrintableAscii(value: string) {
  return /^[\x21-\x7E]+$/.test(value);
}

function normalizeArrangementAiConfig(config: ArrangementAiConfig): ArrangementAiConfig {
  return {
    apiKey: sanitizeArrangementAiToken(config.apiKey.trim()),
    baseUrl: config.baseUrl.trim(),
    model: config.model.trim(),
  };
}

function normalizeStoredArrangement(value: unknown): ArrangementItem | null {
  if (!value || typeof value !== "object") return null;

  const arrangement = value as Partial<ArrangementItem>;
  if (
    typeof arrangement.uid !== "string" ||
    typeof arrangement.title !== "string" ||
    typeof arrangement.content !== "string" ||
    typeof arrangement.createAt !== "number" ||
    typeof arrangement.updateAt !== "number" ||
    !Number.isFinite(arrangement.createAt) ||
    !Number.isFinite(arrangement.updateAt)
  ) {
    return null;
  }

  const scheduledAt =
    typeof arrangement.scheduledAt === "number" && Number.isFinite(arrangement.scheduledAt)
      ? arrangement.scheduledAt
      : null;
  const status: ArrangementStatus =
    arrangement.status === "completed" ||
    arrangement.status === "paused" ||
    arrangement.status === "expired"
      ? arrangement.status
      : "todo";
  const normalizedStatus: ArrangementStatus =
    status === "todo" ? getOpenArrangementStatus(scheduledAt) : status;
  const completedAt =
    typeof arrangement.completedAt === "number" && Number.isFinite(arrangement.completedAt)
      ? arrangement.completedAt
      : null;
  const pausedAt =
    typeof arrangement.pausedAt === "number" && Number.isFinite(arrangement.pausedAt)
      ? arrangement.pausedAt
      : null;
  const kind: ArrangementKind =
    arrangement.kind === "schedule" ||
    arrangement.kind === "reminder" ||
    arrangement.kind === "note"
      ? arrangement.kind
      : "task";
  const priority: ArrangementPriority =
    arrangement.priority === "low" ||
    arrangement.priority === "important" ||
    arrangement.priority === "urgent"
      ? arrangement.priority
      : "normal";

  const source = normalizeArrangementSource(arrangement.source);

  return {
    uid: arrangement.uid,
    title: arrangement.title,
    content: arrangement.content,
    kind,
    priority,
    location: typeof arrangement.location === "string" ? arrangement.location.trim() : "",
    participants: normalizeArrangementTextList(arrangement.participants),
    tags: normalizeArrangementTextList(arrangement.tags),
    checklist: normalizeArrangementChecklist(arrangement.checklist),
    completionCriteria:
      typeof arrangement.completionCriteria === "string"
        ? arrangement.completionCriteria.trim()
        : "",
    source,
    sources: normalizeArrangementSources(arrangement.sources, source),
    mergeGroupId:
      typeof arrangement.mergeGroupId === "string" && arrangement.mergeGroupId.trim()
        ? arrangement.mergeGroupId.trim()
        : null,
    scheduledAt,
    status: normalizedStatus,
    completedAt,
    pausedAt,
    aiAction:
      arrangement.aiAction === "create" ||
      arrangement.aiAction === "update" ||
      arrangement.aiAction === "complete" ||
      arrangement.aiAction === "merge"
        ? arrangement.aiAction
        : null,
    aiSummary: typeof arrangement.aiSummary === "string" ? arrangement.aiSummary.trim() : "",
    aiRelatedArrangementTitles: normalizeArrangementTextList(
      arrangement.aiRelatedArrangementTitles
    ),
    aiProcessedAt:
      typeof arrangement.aiProcessedAt === "number" &&
      Number.isFinite(arrangement.aiProcessedAt)
        ? arrangement.aiProcessedAt
        : null,
    createAt: arrangement.createAt,
    updateAt: arrangement.updateAt,
  };
}

const arrangementKindOptions: Array<{ value: ArrangementKind; label: string }> = [
  { value: "task", label: "\u4efb\u52a1" },
  { value: "schedule", label: "\u65e5\u7a0b" },
  { value: "reminder", label: "\u63d0\u9192" },
  { value: "note", label: "\u5f85\u5b9a" },
];

const arrangementPriorityOptions: Array<{ value: ArrangementPriority; label: string }> = [
  { value: "normal", label: "\u666e\u901a" },
  { value: "important", label: "\u91cd\u8981" },
  { value: "urgent", label: "\u7d27\u6025" },
  { value: "low", label: "\u4f4e\u4f18\u5148" },
];

const defaultArrangementSource: ArrangementSource = {
  type: "manual",
  label: "\u624b\u52a8\u521b\u5efa",
  text: "",
};

function getArrangementKindLabel(kind: ArrangementKind) {
  return arrangementKindOptions.find((option) => option.value === kind)?.label ?? "\u4efb\u52a1";
}

function getArrangementPriorityLabel(priority: ArrangementPriority) {
  return (
    arrangementPriorityOptions.find((option) => option.value === priority)?.label ?? "\u666e\u901a"
  );
}

function getArrangementPriorityPillClass(priority: ArrangementPriority) {
  if (priority === "urgent") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300";
  }
  if (priority === "important") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300";
  }
  if (priority === "low") {
    return "bg-surface-subtle text-text-tertiary";
  }
  return "bg-primary-soft text-primary";
}

function getArrangementAiActionLabel(action: ArrangementAiAction | null) {
  if (action === "complete") return "标记完成";
  if (action === "merge") return "合并重规划";
  if (action === "update") return "更新原安排";
  if (action === "create") return "新建草稿";
  return "";
}

function shouldShowArrangementKind(kind: ArrangementKind) {
  return kind !== "task";
}

function shouldShowArrangementPriority(priority: ArrangementPriority) {
  return priority !== "normal";
}

function normalizeArrangementTextList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeArrangementChecklist(value: unknown): ArrangementChecklistItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Partial<ArrangementChecklistItem> =>
      Boolean(item) && typeof item === "object" && typeof item.text === "string"
    )
    .map((item, index) => ({
      uid:
        typeof item.uid === "string" && item.uid.trim()
          ? item.uid
          : `checklist-${index}`,
      text: item.text?.trim() ?? "",
      completed: item.completed === true,
    }))
    .filter((item) => item.text.length > 0);
}

function normalizeArrangementSource(value: unknown): ArrangementSource {
  if (!value || typeof value !== "object") return defaultArrangementSource;

  const source = value as Partial<ArrangementSource>;
  const type: ArrangementSourceType =
    source.type === "text" || source.type === "conversation" ? source.type : "manual";

  return {
    type,
    label:
      typeof source.label === "string" && source.label.trim()
        ? source.label.trim()
        : type === "manual"
          ? "\u624b\u52a8\u521b\u5efa"
          : "\u6587\u672c\u8bc6\u522b",
    text: typeof source.text === "string" ? source.text.trim() : "",
  };
}

function normalizeArrangementSources(value: unknown, fallback: ArrangementSource) {
  if (!Array.isArray(value)) return [fallback];

  const sources = value
    .map(normalizeArrangementSource)
    .filter((source) => source.label || source.text);

  return sources.length > 0 ? sources : [fallback];
}

function isArrangementAiConfigReady(config: ArrangementAiConfig) {
  return Boolean(config.apiKey && config.baseUrl && config.model);
}

function normalizeArrangementAiConfidence(value: unknown): ArrangementAiConfidence {
  if (value === "high" || value === "low") return value;
  return "medium";
}

function normalizeArrangementAiRecognitionResult(
  value: unknown,
  rawResponse: string,
  fallbackText: string
): ArrangementAiRecognitionResult {
  const result = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const fallbackTitle = fallbackText.trim().slice(0, 18) || "\u672a\u547d\u540d\u5b89\u6392";
  const fallbackContent = fallbackText.trim() || "\u672a\u8bc6\u522b\u5230\u660e\u786e\u5b89\u6392\u5185\u5bb9";
  const kind =
    result.kind === "schedule" ||
    result.kind === "reminder" ||
    result.kind === "note" ||
    result.kind === "task"
      ? result.kind
      : "task";
  const priority =
    result.priority === "low" ||
    result.priority === "important" ||
    result.priority === "urgent" ||
    result.priority === "normal"
      ? result.priority
      : "normal";

  return {
    action:
      result.action === "update" ||
      result.action === "complete" ||
      result.action === "merge"
        ? result.action
        : "create",
    targetUid: typeof result.targetUid === "string" ? result.targetUid.trim() : "",
    targetUids: normalizeArrangementTextList(result.targetUids),
    title: typeof result.title === "string" && result.title.trim() ? result.title.trim() : fallbackTitle,
    content:
      typeof result.content === "string" && result.content.trim()
        ? result.content.trim()
        : fallbackContent,
    kind,
    priority,
    scheduledAt: typeof result.scheduledAt === "string" ? result.scheduledAt.trim() : "",
    scheduledAtText:
      typeof result.scheduledAtText === "string" ? result.scheduledAtText.trim() : "",
    location: typeof result.location === "string" ? result.location.trim() : "",
    participants: normalizeArrangementTextList(result.participants),
    tags: normalizeArrangementTextList(result.tags),
    completionCriteria:
      typeof result.completionCriteria === "string"
        ? result.completionCriteria.trim()
        : "",
    confidence: normalizeArrangementAiConfidence(result.confidence),
    notes: typeof result.notes === "string" ? result.notes.trim() : "",
    optimizationSummary:
      typeof result.optimizationSummary === "string"
        ? result.optimizationSummary.trim()
        : "",
    rawResponse,
  };
}

function extractArrangementTextCues(arrangement: ArrangementItem) {
  return dedupeArrangementTextList([
    arrangement.title,
    arrangement.location,
    ...arrangement.participants,
    ...arrangement.tags,
  ]).filter((item) => item.length >= 2);
}

function getArrangementAiContextRank(inputText: string, arrangement: ArrangementItem) {
  const normalizedInput = inputText.trim().toLowerCase();
  if (!normalizedInput) return 0;

  let score = 0;
  for (const cue of extractArrangementTextCues(arrangement)) {
    const normalizedCue = cue.toLowerCase();
    if (normalizedInput.includes(normalizedCue)) {
      score += arrangement.location === cue ? 8 : 4;
    }
  }

  if (/今天|今晚|明天|后天|下周|周|星期|上午|下午|晚上|中午|凌晨/.test(inputText)) {
    score += arrangement.scheduledAt !== null ? 2 : 0;
  }
  if (arrangement.status === "todo") score += 2;
  if (arrangement.priority === "urgent") score += 2;
  if (arrangement.priority === "important") score += 1;

  return score;
}

function selectRelevantArrangementsForAi(inputText: string, arrangements: ArrangementItem[]) {
  const openArrangements = arrangements.filter((arrangement) => arrangement.status !== "completed");

  return [...openArrangements]
    .sort((a, b) => {
      const scoreDiff =
        getArrangementAiContextRank(inputText, b) -
        getArrangementAiContextRank(inputText, a);
      if (scoreDiff !== 0) return scoreDiff;

      const timeA = a.scheduledAt ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.scheduledAt ?? Number.MAX_SAFE_INTEGER;
      if (timeA !== timeB) return timeA - timeB;

      return b.updateAt - a.updateAt;
    })
    .slice(0, 12);
}

function formatArrangementAiContext(inputText: string, arrangements: ArrangementItem[]) {
  const openArrangements = selectRelevantArrangementsForAi(inputText, arrangements);

  if (openArrangements.length === 0) {
    return "No unfinished arrangements.";
  }

  return openArrangements
    .map((arrangement, index) => {
      const timeLabel = arrangement.scheduledAt
        ? formatArrangementDateTime(arrangement.scheduledAt)
        : "unscheduled";
      return [
        `${index + 1}. uid=${arrangement.uid} | ${arrangement.title}`,
        `status=${arrangement.status}`,
        `priority=${arrangement.priority}`,
        `kind=${arrangement.kind}`,
        `time=${timeLabel}`,
        arrangement.location ? `location=${arrangement.location}` : "",
        arrangement.participants.length > 0
          ? `participants=${arrangement.participants.join("/")}`
          : "",
        arrangement.tags.length > 0 ? `tags=${arrangement.tags.join("/")}` : "",
        arrangement.content ? `content=${arrangement.content}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n");
}

function dedupeArrangementTextList(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function dedupeArrangementSources(sources: ArrangementSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.type}::${source.label}::${source.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveArrangementAiEndpoint(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl;
  }
  return `${normalizedBaseUrl}/chat/completions`;
}

function extractJsonBlock(text: string) {
  const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeFenceMatch?.[1]) {
    return codeFenceMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

async function recognizeArrangementFromText(
  config: ArrangementAiConfig,
  inputText: string,
  arrangements: ArrangementItem[]
): Promise<ArrangementAiRecognitionResult> {
  const normalizedConfig = normalizeArrangementAiConfig(config);
  if (!hasOnlyPrintableAscii(normalizedConfig.apiKey)) {
    throw new Error("API Key \u5305\u542b\u975e ASCII \u5b57\u7b26\u3002\u8bf7\u91cd\u65b0\u7c98\u8d34\uff0c\u907f\u514d\u4e2d\u6587\u7a7a\u683c\u3001\u6362\u884c\u6216\u96f6\u5bbd\u5b57\u7b26\u3002");
  }

  const response = await fetch(resolveArrangementAiEndpoint(normalizedConfig.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${normalizedConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: normalizedConfig.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            [
              "You extract one arrangement candidate from user text.",
              "Return JSON only, without markdown fences.",
              "Today is 2026-05-17 and timezone is Asia/Hong_Kong (UTC+08:00).",
              "If the user mentions a relative time such as tomorrow, next Monday evening, or tonight, resolve it into scheduledAt using this timezone when reasonably inferable.",
              "scheduledAt must be in YYYY-MM-DDTHH:mm format or an empty string when you cannot infer a concrete datetime.",
              "Always infer kind and location when there is enough evidence; otherwise use kind=task and location=''.",
              "Assess priority relative to the unfinished arrangements I provide. Use urgent only when it is clearly more time-sensitive or more important than most unfinished arrangements.",
              "Choose action=create when this is a new arrangement.",
              "Choose action=update when the text is a follow-up, refinement, or better wording for one existing arrangement.",
              "Choose action=complete when the text strongly indicates one existing arrangement is already finished.",
              "Choose action=merge when the text should cause one or more existing arrangements to be consolidated or replanned together.",
              "Treat same location plus nearby time as a strong merge/replan signal, even if wording differs.",
              "When action is update, complete, or merge, fill targetUid with the best primary uid from the provided arrangements.",
              "When action is merge, fill targetUids with all related arrangement uids that should be grouped or consolidated.",
              "Do not only append text. Optimize the resulting arrangement so the user gets a cleaner, more useful plan.",
              "Use this schema:",
              '{"action":"create|update|complete|merge","targetUid":"string","targetUids":["string"],"title":"string","content":"string","kind":"task|schedule|reminder|note","priority":"low|normal|important|urgent","scheduledAt":"string","scheduledAtText":"string","location":"string","participants":["string"],"tags":["string"],"completionCriteria":"string","confidence":"low|medium|high","notes":"string","optimizationSummary":"string"}',
              "If the text is ambiguous, keep confidence low and explain uncertainty in notes.",
            ].join(" "),
        },
        {
          role: "user",
          content: [
            "User text:",
            inputText,
            "",
            "Current unfinished arrangements for priority comparison and merge/replan reference:",
            formatArrangementAiContext(inputText, arrangements),
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  const rawContent = payload.choices?.[0]?.message?.content?.trim() ?? "";
  if (!rawContent) {
    throw new Error(payload.error?.message || "\u6a21\u578b\u6ca1\u6709\u8fd4\u56de\u53ef\u89e3\u6790\u5185\u5bb9");
  }

  try {
    return normalizeArrangementAiRecognitionResult(
      JSON.parse(extractJsonBlock(rawContent)),
      rawContent,
      inputText
    );
  } catch {
    throw new Error("\u6a21\u578b\u8fd4\u56de\u5185\u5bb9\u4e0d\u662f\u6709\u6548 JSON\uff0c\u8bf7\u8c03\u6574\u6a21\u578b\u6216 Base URL \u540e\u91cd\u8bd5");
  }
}

function inferScheduledAtFromNaturalLanguage(text: string, now = new Date()) {
  const normalized = text.trim();
  if (!normalized) return null;

  const directMatch = normalized.match(/(\d{4})[-/.\u5e74](\d{1,2})[-/.\u6708](\d{1,2})[\u65e5\u53f7]?(?:\s*|[ T])(?:(\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u665a\u4e0a|\u51cc\u6668))?\s*(\d{1,2})(?:[:\u70b9\u65f6](\d{1,2}))?/);
  if (directMatch) {
    const [, year, month, day, period, hourValue, minuteValue] = directMatch;
    const hour = Number(hourValue);
    const minute = minuteValue ? Number(minuteValue) : 0;
    const date = new Date(Number(year), Number(month) - 1, Number(day), normalizeChineseHour(hour, period), minute, 0, 0);
    return Number.isFinite(date.getTime()) ? date.getTime() : null;
  }

  const target = new Date(now);
  target.setSeconds(0, 0);
  let matchedDay = false;

  if (/\u4eca\u5929/.test(normalized)) {
    matchedDay = true;
  } else if (/\u660e\u5929/.test(normalized)) {
    target.setDate(target.getDate() + 1);
    matchedDay = true;
  } else if (/\u540e\u5929/.test(normalized)) {
    target.setDate(target.getDate() + 2);
    matchedDay = true;
  } else if (/\u5927\u540e\u5929/.test(normalized)) {
    target.setDate(target.getDate() + 3);
    matchedDay = true;
  } else {
    const weekMatch = normalized.match(/(\u672c\u5468|\u8fd9\u5468|\u4e0b\u5468)?(?:\u5468|\u661f\u671f)([\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u65e5\u5929])/);
    if (weekMatch) {
      const [, prefix = "", weekdayToken] = weekMatch;
      const weekdayMap: Record<string, number> = {
        "\u4e00": 1,
        "\u4e8c": 2,
        "\u4e09": 3,
        "\u56db": 4,
        "\u4e94": 5,
        "\u516d": 6,
        "\u65e5": 0,
        "\u5929": 0,
      };
      const targetWeekday = weekdayMap[weekdayToken];
      const currentWeekday = target.getDay();
      let delta = (targetWeekday - currentWeekday + 7) % 7;
      if (prefix === "\u4e0b\u5468") {
        delta = delta === 0 ? 7 : delta + 7;
      } else if (prefix === "\u672c\u5468" || prefix === "\u8fd9\u5468") {
        delta = delta === 0 ? 0 : delta;
      } else if (delta === 0 && !/\u4eca\u5929/.test(normalized)) {
        delta = 7;
      }
      target.setDate(target.getDate() + delta);
      matchedDay = true;
    }
  }

  if (!matchedDay) return null;

  const timeMatch = normalized.match(/(\u51cc\u6668|\u65e9\u4e0a|\u4e0a\u5348|\u4e2d\u5348|\u4e0b\u5348|\u508d\u665a|\u665a\u4e0a)?\s*(\d{1,2})(?:[:\u70b9\u65f6](\d{1,2}))?(?:\u534a|\u5206)?/);
  let hour = 9;
  let minute = 0;
  let period = "";
  if (timeMatch) {
    period = timeMatch[1] ?? "";
    hour = Number(timeMatch[2]);
    minute = timeMatch[3] ? Number(timeMatch[3]) : /\u534a/.test(timeMatch[0]) ? 30 : 0;
  } else if (/\u51cc\u6668/.test(normalized)) {
    hour = 1;
    period = "\u51cc\u6668";
  } else if (/(\u65e9\u4e0a|\u4e0a\u5348)/.test(normalized)) {
    hour = 9;
    period = "\u4e0a\u5348";
  } else if (/\u4e2d\u5348/.test(normalized)) {
    hour = 12;
    period = "\u4e2d\u5348";
  } else if (/(\u4e0b\u5348|\u508d\u665a)/.test(normalized)) {
    hour = 15;
    period = "\u4e0b\u5348";
  } else if (/\u665a\u4e0a/.test(normalized)) {
    hour = 19;
    period = "\u665a\u4e0a";
  }

  target.setHours(normalizeChineseHour(hour, period), minute, 0, 0);
  return Number.isFinite(target.getTime()) ? target.getTime() : null;
}

function normalizeChineseHour(hour: number, period?: string) {
  if (!Number.isFinite(hour)) return 9;
  if (period === "\u51cc\u6668") {
    return hour === 12 ? 0 : hour;
  }
  if (period === "\u4e2d\u5348") {
    return hour < 11 ? hour + 12 : hour;
  }
  if (period === "\u4e0b\u5348" || period === "\u508d\u665a" || period === "\u665a\u4e0a") {
    return hour < 12 ? hour + 12 : hour;
  }
  return hour;
}

function parseArrangementTextList(value: string) {
  return value
    .split(/[\n,\uff0c\u3001]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatArrangementTextList(items: string[]) {
  return items.join("\u3001");
}

function parseArrangementChecklist(value: string, now: number): ArrangementChecklistItem[] {
  return value
    .split(/\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((text, index) => ({
      uid: `checklist-${now}-${index}`,
      text,
      completed: false,
    }));
}

function getInitialArrangements() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(arrangementsStorageKey);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .map(normalizeStoredArrangement)
      .filter((arrangement): arrangement is ArrangementItem => Boolean(arrangement));
  } catch {
    return [];
  }
}

function persistArrangements(arrangements: ArrangementItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(arrangementsStorageKey, JSON.stringify(arrangements));
  } catch {
    // Keep the visible in-memory arrangements if storage is unavailable.
  }
}

function formatArrangementDateTime(timestamp: number | null) {
  if (!timestamp) return "\u672a\u8bbe\u7f6e\u65f6\u95f4";

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatArrangementCountdown(timestamp: number | null, now: number) {
  if (timestamp === null) return "";

  const diff = timestamp - now;
  const absMinutes = Math.max(1, Math.round(Math.abs(diff) / 60000));
  const days = Math.floor(absMinutes / 1440);
  const hours = Math.floor((absMinutes % 1440) / 60);
  const minutes = absMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}\u5929`);
  if (hours > 0) parts.push(`${hours}\u5c0f\u65f6`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}\u5206\u949f`);
  if (parts.length === 0) parts.push("1\u5206\u949f");

  return diff >= 0 ? `\u8fd8\u6709${parts.join("")}` : `\u5df2\u8fc7${parts.join("")}`;
}
function getArrangementCountdownClass(
  status: ArrangementStatus,
  priority: ArrangementPriority,
  scheduledAt: number | null,
  now: number
) {
  if (scheduledAt === null || status === "completed" || status === "expired") {
    return "text-text-tertiary";
  }

  const diff = scheduledAt - now;
  if (diff <= 60 * 60 * 1000 || priority === "urgent") {
    return "text-rose-600 dark:text-rose-300";
  }
  if (diff <= 24 * 60 * 60 * 1000 || priority === "important") {
    return "text-amber-600 dark:text-amber-300";
  }
  if (priority === "low") {
    return "text-text-tertiary";
  }
  return "text-primary";
}

function toDateTimeLocalValue(timestamp: number | null) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseArrangementScheduledTime(value: string) {
  if (!value) return null;

  const parsedValue = new Date(value).getTime();
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getOpenArrangementStatus(scheduledAt: number | null, now = Date.now()): ArrangementStatus {
  return scheduledAt !== null && scheduledAt < now ? "expired" : "todo";
}

function getArrangementStatusLabel(status: ArrangementStatus) {
  if (status === "completed") return "\u5b8c\u6210";
  if (status === "paused") return "\u6682\u7f13";
  if (status === "expired") return "\u5df2\u8fc7\u671f";
  return "\u5f85\u5904\u7406";
}

function getNextFriday() {
  const date = new Date();
  const day = date.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilFriday);
  date.setHours(18, 0, 0, 0);
  return date.getTime();
}

function getArrangementStatusCardClass(status: ArrangementStatus) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/20";
  }
  if (status === "expired") {
    return "border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/20";
  }
  if (status === "paused") {
    return "border-amber-300/70 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20";
  }
  return "border-primary/35 bg-[var(--record-card-bg)]";
}

function getArrangementStatusDotClass(status: ArrangementStatus) {
  if (status === "completed") return "bg-emerald-500";
  if (status === "expired") return "bg-rose-500";
  if (status === "paused") return "bg-amber-500";
  return "bg-primary";
}

function getArrangementStatusPillClass(status: ArrangementStatus) {
  if (status === "completed") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300";
  }
  if (status === "expired") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300";
  }
  if (status === "paused") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300";
  }
  return "bg-primary-soft text-primary";
}

function makeRecordReference(record: RecordItem): RecordReference {
  return {
    uid: record.uid,
    text_content: record.text_content,
    send_at: record.send_at,
    create_at: record.create_at,
    update_at: record.update_at,
    ...(record.sourceConversation ? { sourceConversation: record.sourceConversation } : {}),
  };
}

function getInitialSearchHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(searchHistoryStorageKey);
    if (!storedValue) return [];
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];
    return parsedValue
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, maxSearchHistoryCount);
  } catch {
    return [];
  }
}

function persistSearchHistory(history: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(searchHistoryStorageKey, JSON.stringify(history));
  } catch {
    // Keep the visible in-memory history if storage is unavailable.
  }
}

function parseAiConversationTimestamp(value: string, fallbackTime: number) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) return fallbackTime;

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ).getTime();
}

function countRecordTextLength(value: string) {
  return Array.from(value.trim()).length;
}

function formatNumberForLocale(value: number, locale: string) {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

function formatStatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

function openExternalLink(url: string) {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function shouldRequestBrowserNotificationPermission() {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(browserNotificationPromptedStorageKey) === "true") {
    return false;
  }
  window.localStorage.setItem(browserNotificationPromptedStorageKey, "true");
  return true;
}

export default function Home({ currentPage, onNavigate }: HomeProps) {
  const { t } = usePreferences();
  const [showSearch, setShowSearch] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showAnswerGuide, setShowAnswerGuide] = React.useState(false);
  const [showAiConversation, setShowAiConversation] = React.useState(false);
  const [showSendToSelf, setShowSendToSelf] = React.useState(false);
  const [showTestConversation, setShowTestConversation] = React.useState(false);
  const [conversationReturnContext, setConversationReturnContext] =
    React.useState<ConversationReturnContext>({ mode: "drawer" });
  const [aiConversationTargetIndex, setAiConversationTargetIndex] =
    React.useState<number | null>(null);
  const [sendToSelfTargetUid, setSendToSelfTargetUid] = React.useState<string | null>(null);
  const [activeTestIdentityId, setActiveTestIdentityId] = React.useState<string | null>(null);
  const [testConversationTargetUid, setTestConversationTargetUid] = React.useState<string | null>(null);
  const [settingsView, setSettingsView] = React.useState<
    null | "settings" | "appearance" | "about" | "arrangement-ai"
  >(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchHistory, setSearchHistory] = React.useState(getInitialSearchHistory);
  const [recordDetail, setRecordDetail] = React.useState<RecordItem | null>(null);
  const [recordSnapshot, setRecordSnapshot] = React.useState<RecordItem | null>(null);
  const [lastReadAiConversationCount, setLastReadAiConversationCount] =
    React.useState(getInitialAiConversationReadCount);
  const recordsDemoBaseTime = React.useMemo(() => Date.now(), []);
  const selfDemoBaseTime = React.useMemo(() => Date.now(), []);
  const [createdSelfRecords, setCreatedSelfRecords] = React.useState(
    getInitialCreatedSelfRecords
  );
  const [arrangementAiConfig, setArrangementAiConfig] = React.useState(
    getInitialArrangementAiConfig
  );
  const [testIdentities, setTestIdentities] = React.useState(getInitialTestIdentities);
  const [testGroups, setTestGroups] = React.useState(getInitialTestGroups);
  const [testMessages, setTestMessages] = React.useState(getInitialTestMessages);
  const [testReadState, setTestReadState] =
    React.useState<TestReadState>(getInitialTestReadState);
  const initializedBrowserNotificationMessagesRef = React.useRef(false);
  const browserNotifiedMessageIdsRef = React.useRef<Set<string>>(new Set());

  const unreadAiConversationCount = Math.max(
    0,
    aiConversationTotalCount - lastReadAiConversationCount
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshTestConversations = () => {
      setTestIdentities(getInitialTestIdentities());
      setTestGroups(getInitialTestGroups());
      setTestMessages(getInitialTestMessages());
      setTestReadState(getInitialTestReadState());
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== testIdentitiesStorageKey &&
        event.key !== testGroupsStorageKey &&
        event.key !== testMessagesStorageKey &&
        event.key !== testReadStateStorageKey
      ) {
        return;
      }
      refreshTestConversations();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(testConversationStorageEvent, refreshTestConversations);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(testConversationStorageEvent, refreshTestConversations);
    };
  }, []);

  const markAiConversationAsRead = React.useCallback(() => {
    setLastReadAiConversationCount(aiConversationTotalCount);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        aiConversationReadCountStorageKey,
        String(aiConversationTotalCount)
      );
    }
  }, []);

  const makeSelfSource = React.useCallback(
    (recordUid: string): RecordSourceConversation => ({
      type: "self",
      label: t("sendToSelf.title"),
      actionLabel: t("sendToSelf.open"),
      iconLabel: t("sendToSelf.icon"),
      recordUid,
    }),
    [t]
  );

  const makeTestSource = React.useCallback(
    (
      label: string,
      iconLabel: string,
      conversationId: string,
      recordUid?: string
    ): RecordSourceConversation => ({
      type: "test",
      label,
      actionLabel: t("records.openSource"),
      iconLabel,
      conversationId,
      recordUid,
    }),
    [t]
  );

  const demoRecords = React.useMemo<RecordItem[]>(
    () => [
      {
        uid: "demo-1",
        text_content: t("records.demo1"),
        send_at: recordsDemoBaseTime - 1000 * 60 * 60 * 5,
        create_at: recordsDemoBaseTime - 1000 * 60 * 60 * 5,
        update_at: recordsDemoBaseTime - 1000 * 60 * 60 * 5,
      },
      {
        uid: "demo-2",
        text_content: t("records.demo2"),
        send_at: recordsDemoBaseTime - 1000 * 60 * 45,
        create_at: recordsDemoBaseTime - 1000 * 60 * 45,
        update_at: recordsDemoBaseTime - 1000 * 60 * 45,
      },
      {
        uid: "demo-3",
        text_content: t("records.demo3"),
        send_at: recordsDemoBaseTime - 1000 * 60 * 12,
        create_at: recordsDemoBaseTime - 1000 * 60 * 12,
        update_at: recordsDemoBaseTime - 1000 * 60 * 12,
      },
    ],
    [recordsDemoBaseTime, t]
  );

  const aiConversationRecords = React.useMemo<RecordItem[]>(
    () =>
      aiConversationLogEntries.map((entry, index) => {
        const timestamp = parseAiConversationTimestamp(
          entry.timestamp,
          recordsDemoBaseTime + index
        );
        return {
          uid: `ai-conversation-user-${index}`,
          text_content: entry.userInput,
          send_at: timestamp,
          create_at: timestamp,
          update_at: timestamp,
          sourceConversation: {
            type: "ai",
            label: t("ai.title"),
            actionLabel: t("records.openSource"),
            iconLabel: "AI",
            entryIndex: index,
          },
        };
      }),
    [recordsDemoBaseTime, t]
  );

  const selfDemoRecords = React.useMemo<RecordItem[]>(
    () => [
      {
        uid: "self-demo-1",
        text_content: t("sendToSelf.demo1"),
        send_at: selfDemoBaseTime - 1000 * 60 * 28,
        create_at: selfDemoBaseTime - 1000 * 60 * 28,
        update_at: selfDemoBaseTime - 1000 * 60 * 28,
        sourceConversation: makeSelfSource("self-demo-1"),
      },
      {
        uid: "self-demo-2",
        text_content: t("sendToSelf.demo2"),
        send_at: selfDemoBaseTime - 1000 * 60 * 7,
        create_at: selfDemoBaseTime - 1000 * 60 * 7,
        update_at: selfDemoBaseTime - 1000 * 60 * 7,
        sourceConversation: makeSelfSource("self-demo-2"),
      },
    ],
    [makeSelfSource, selfDemoBaseTime, t]
  );

  const selfRecords = React.useMemo(
    () =>
      [...selfDemoRecords, ...createdSelfRecords].map((record) => ({
        ...record,
        sourceConversation: makeSelfSource(record.uid),
      })),
    [createdSelfRecords, makeSelfSource, selfDemoRecords]
  );

  const testConversationRecords = React.useMemo<TestConversationRecord[]>(
    () =>
      testMessages
        .map<TestConversationRecord | null>((message) => {
          const identity = testIdentities.find((item) => item.id === message.identityId);
          const group = testGroups.find((item) => item.id === message.conversationId);
          const isGroup = message.conversationType === "group";
          const privateIdentity =
            !isGroup
              ? testIdentities.find(
                  (item) => getPrivateConversationId(item.id) === message.conversationId
                )
              : null;
          const sourceLabel = isGroup ? group?.name : privateIdentity?.name;
          const iconLabel = isGroup ? group?.avatarLabel : privateIdentity?.avatarLabel;
          if (!sourceLabel || !iconLabel) return null;
          if (message.sender === "identity" && !identity) return null;

          const uid = `test-${message.id}`;
          return {
            uid,
            text_content: message.text,
            send_at: message.sentAt,
            create_at: message.sentAt,
            update_at: message.sentAt,
            sourceConversation: makeTestSource(
              sourceLabel,
              iconLabel,
              message.conversationId,
              uid
            ),
            sender: message.sender,
            identityId: message.identityId,
          };
        })
        .filter((record): record is TestConversationRecord => Boolean(record)),
    [makeTestSource, testGroups, testIdentities, testMessages]
  );

  const testDemoReplyRecords = React.useMemo<RecordItem[]>(
    () => testConversationRecords.filter((record) => record.sender === "demo"),
    [testConversationRecords]
  );

  const testConversationSummaries = React.useMemo<TestConversationSummary[]>(
    () => {
      const privateSummaries = testIdentities
        .map<TestConversationSummary | null>((identity) => {
          const conversationId = getPrivateConversationId(identity.id);
          const records = testConversationRecords.filter(
            (record) => record.sourceConversation?.conversationId === conversationId
          );
          const messages = testMessages.filter(
            (message) => message.conversationId === conversationId
          );
          const unreadIdentityMessages = messages.filter(
            (message) =>
              message.sender === "identity" &&
              message.sentAt > (testReadState[conversationId] ?? 0)
          );
          const latestMessage = messages.reduce<TestMessage | null>(
            (latest, message) => {
              if (!latest || message.sentAt > latest.sentAt) return message;
              return latest;
            },
            null
          );
          const latestUnreadIdentityMessage =
            unreadIdentityMessages.reduce<TestMessage | null>(
              (latest, message) => {
                if (!latest || message.sentAt > latest.sentAt) return message;
                return latest;
              },
              null
            );

          if (!latestMessage) return null;

          return {
            conversationId,
            conversationType: "private",
            title: identity.name,
            subtitle: identity.note || "娴嬭瘯绉佽亰",
            avatarLabel: identity.avatarLabel,
            color: identity.color,
            identity,
            memberIdentities: [identity],
            records,
            latestMessage,
            latestUnreadIdentityMessage,
            unreadCount: unreadIdentityMessages.length,
          };
        });
      const groupSummaries = testGroups
        .map<TestConversationSummary | null>((group) => {
          const memberIdentities = group.memberIdentityIds
            .map((identityId) => testIdentities.find((identity) => identity.id === identityId))
            .filter((identity): identity is TestIdentity => Boolean(identity));
          const records = testConversationRecords.filter(
            (record) => record.sourceConversation?.conversationId === group.id
          );
          const messages = testMessages.filter(
            (message) => message.conversationId === group.id
          );
          const unreadIdentityMessages = messages.filter(
            (message) =>
              message.sender === "identity" &&
              message.sentAt > (testReadState[group.id] ?? 0)
          );
          const latestMessage = messages.reduce<TestMessage | null>(
            (latest, message) => {
              if (!latest || message.sentAt > latest.sentAt) return message;
              return latest;
            },
            null
          );
          const latestUnreadIdentityMessage =
            unreadIdentityMessages.reduce<TestMessage | null>(
              (latest, message) => {
                if (!latest || message.sentAt > latest.sentAt) return message;
                return latest;
              },
              null
            );

          if (!latestMessage) {
            return {
              conversationId: group.id,
              conversationType: "group",
              title: group.name,
              subtitle: group.note || `${memberIdentities.length} 位成员`,
              avatarLabel: group.avatarLabel,
              color: group.color,
              group,
              memberIdentities,
              records,
              latestMessage: {
                id: `empty-${group.id}`,
                conversationId: group.id,
                conversationType: "group",
                identityId: demoSenderIdentityId,
                text: "群聊能力已开启，可从后台发送群消息测试。",
                sentAt: group.createdAt,
                sender: "demo",
              },
              latestUnreadIdentityMessage: null,
              unreadCount: 0,
            };
          }

          return {
            conversationId: group.id,
            conversationType: "group",
            title: group.name,
            subtitle: group.note || `${memberIdentities.length} 位成员`,
            avatarLabel: group.avatarLabel,
            color: group.color,
            group,
            memberIdentities,
            records,
            latestMessage,
            latestUnreadIdentityMessage,
            unreadCount: unreadIdentityMessages.length,
          };
        });

      return [...privateSummaries, ...groupSummaries]
        .filter((summary): summary is TestConversationSummary => Boolean(summary))
        .sort((a, b) => b.latestMessage.sentAt - a.latestMessage.sentAt);
    },
    [testConversationRecords, testGroups, testIdentities, testMessages, testReadState]
  );

  const unreadTestConversationCount = testConversationSummaries.reduce(
    (total, summary) => total + summary.unreadCount,
    0
  );
  const homeMessagePreview = React.useMemo<HomeMessagePreview | null>(
    () =>
      testConversationSummaries.reduce<HomeMessagePreview | null>(
        (latestPreview, summary) => {
          if (!summary.latestUnreadIdentityMessage) return latestPreview;
          if (
            latestPreview &&
            latestPreview.message.sentAt >= summary.latestUnreadIdentityMessage.sentAt
          ) {
            return latestPreview;
          }
          return {
            summary,
            message: summary.latestUnreadIdentityMessage,
            unreadCount: summary.unreadCount,
          };
        },
        null
      ),
    [testConversationSummaries]
  );

  const activeTestConversationSummary =
    testConversationSummaries.find(
      (summary) => summary.conversationId === activeTestIdentityId
    ) ?? null;

  const mineStatisticRecords = React.useMemo(
    () => [
      ...demoRecords,
      ...aiConversationRecords,
      ...selfRecords,
      ...testDemoReplyRecords,
    ],
    [aiConversationRecords, demoRecords, selfRecords, testDemoReplyRecords]
  );
  const recordDetailExtensionRecords = React.useMemo(
    () =>
      recordDetail
        ? mineStatisticRecords.filter(
            (record) => record.referencedRecord?.uid === recordDetail.uid
          )
        : [],
    [mineStatisticRecords, recordDetail]
  );

  const commitSearchKeyword = React.useCallback((keyword: string) => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return;

    setSearchHistory((prev) => {
      const nextHistory = [
        normalizedKeyword,
        ...prev.filter((value) => value !== normalizedKeyword),
      ].slice(0, maxSearchHistoryCount);
      persistSearchHistory(nextHistory);
      return nextHistory;
    });
  }, []);

  const createSelfRecord = React.useCallback((content: string) => {
    const timestamp = Date.now();
    setCreatedSelfRecords((prev) => {
      const nextRecords = [
        ...prev,
        {
          uid: `self-${timestamp}`,
          text_content: content,
          send_at: timestamp,
          create_at: timestamp,
          update_at: timestamp,
        },
      ];
      persistCreatedSelfRecords(nextRecords);
      return nextRecords;
    });
  }, []);

  const createRecordExtension = React.useCallback((parentRecord: RecordItem, content: string) => {
    const timestamp = Date.now();
    setCreatedSelfRecords((prev) => {
      const nextRecords = [
        ...prev,
        {
          uid: `self-extension-${timestamp}`,
          text_content: content,
          send_at: timestamp,
          create_at: timestamp,
          update_at: timestamp,
          referencedRecord: makeRecordReference(parentRecord),
        },
      ];
      persistCreatedSelfRecords(nextRecords);
      return nextRecords;
    });
  }, []);

  const backToDrawer = () => {
    setShowAnswerGuide(false);
    setShowAiConversation(false);
    setShowSendToSelf(false);
    setShowTestConversation(false);
    setShowMenu(true);
    setConversationReturnContext({ mode: "drawer" });
  };

  const backToPreviousConversationOrigin = () => {
    setShowAnswerGuide(false);
    setShowAiConversation(false);
    setShowSendToSelf(false);
    setShowTestConversation(false);
    setShowMenu(false);

    if (conversationReturnContext.mode === "previous") {
      setRecordDetail(conversationReturnContext.recordDetail);
      setRecordSnapshot(conversationReturnContext.recordSnapshot);
    }

    setConversationReturnContext({ mode: "drawer" });
  };

  const handleConversationBack = () => {
    if (conversationReturnContext.mode === "drawer") {
      backToDrawer();
      return;
    }

    backToPreviousConversationOrigin();
  };

  const openAiConversation = React.useCallback(
    (
      targetIndex: number | null = null,
      returnContext: ConversationReturnContext = { mode: "drawer" }
    ) => {
      markAiConversationAsRead();
      setConversationReturnContext(returnContext);
      setAiConversationTargetIndex(targetIndex);
      setShowMenu(false);
      setShowSendToSelf(false);
      setShowTestConversation(false);
      setShowAiConversation(true);
    },
    [markAiConversationAsRead]
  );

  const openSendToSelf = React.useCallback(
    (
      targetUid: string | null = null,
      returnContext: ConversationReturnContext = { mode: "drawer" }
    ) => {
      setConversationReturnContext(returnContext);
      setShowMenu(false);
      setSendToSelfTargetUid(targetUid);
      setShowAiConversation(false);
      setShowTestConversation(false);
      setShowSendToSelf(true);
    },
    []
  );

  const markTestConversationAsRead = React.useCallback(
    (conversationId: string) => {
      const latestMessageTime = testMessages.reduce((latest, message) => {
        if (message.conversationId !== conversationId) return latest;
        return Math.max(latest, message.sentAt);
      }, 0);

      setTestReadState((prev) => {
        const nextReadState = {
          ...prev,
          [conversationId]: latestMessageTime || Date.now(),
        };
        persistTestReadState(nextReadState);
        return nextReadState;
      });
    },
    [testMessages]
  );

  const openTestConversation = React.useCallback(
    (
      conversationId: string,
      targetUid: string | null = null,
      returnContext: ConversationReturnContext = { mode: "drawer" }
    ) => {
      markTestConversationAsRead(conversationId);
      setConversationReturnContext(returnContext);
      setActiveTestIdentityId(conversationId);
      setTestConversationTargetUid(targetUid);
      setShowMenu(false);
      setShowAiConversation(false);
      setShowSendToSelf(false);
      setShowTestConversation(true);
    },
    [markTestConversationAsRead]
  );

  const returnToHomeFromNotification = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.focus();
    }

    setShowSearch(false);
    setShowMenu(false);
    setShowAnswerGuide(false);
    setShowAiConversation(false);
    setShowSendToSelf(false);
    setShowTestConversation(false);
    setConversationReturnContext({ mode: "drawer" });
    setAiConversationTargetIndex(null);
    setSendToSelfTargetUid(null);
    setActiveTestIdentityId(null);
    setTestConversationTargetUid(null);
    setSettingsView(null);
    setRecordDetail(null);
    setRecordSnapshot(null);
    onNavigate("records");
  }, [onNavigate]);

  const showBrowserMessageNotification = React.useCallback(
    (summary: TestConversationSummary, message: TestMessage) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;

      const showNotification = () => {
        const notification = new Notification(summary.title, {
          body: message.text,
          icon: "/images/logo-jiwo-green.svg",
          tag: `arkme-demo-message-${message.id}`,
        });
        notification.onclick = () => {
          notification.close();
          returnToHomeFromNotification();
        };
      };

      if (Notification.permission === "granted") {
        showNotification();
        return;
      }

      if (
        Notification.permission === "default" &&
        shouldRequestBrowserNotificationPermission()
      ) {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            showNotification();
          }
        });
      }
    },
    [returnToHomeFromNotification]
  );

  React.useEffect(() => {
    if (!showTestConversation || !activeTestIdentityId) return;
    markTestConversationAsRead(activeTestIdentityId);
  }, [
    activeTestIdentityId,
    markTestConversationAsRead,
    showTestConversation,
    testMessages.length,
  ]);

  React.useEffect(() => {
    const identityMessages = testMessages.filter(
      (message) => message.sender === "identity"
    );

    if (!initializedBrowserNotificationMessagesRef.current) {
      identityMessages.forEach((message) => {
        browserNotifiedMessageIdsRef.current.add(message.id);
      });
      initializedBrowserNotificationMessagesRef.current = true;
      return;
    }

    const newIdentityMessages = identityMessages.filter(
      (message) => !browserNotifiedMessageIdsRef.current.has(message.id)
    );
    if (newIdentityMessages.length === 0) return;

    newIdentityMessages.forEach((message) => {
      browserNotifiedMessageIdsRef.current.add(message.id);
    });

    const latestMessage = newIdentityMessages.reduce((latest, message) =>
      message.sentAt > latest.sentAt ? message : latest
    );
    if (
      showTestConversation &&
      activeTestIdentityId === latestMessage.conversationId
    ) {
      return;
    }

    const summary = testConversationSummaries.find(
      (item) => item.conversationId === latestMessage.conversationId
    );
    if (!summary) return;

    showBrowserMessageNotification(summary, latestMessage);
  }, [
    activeTestIdentityId,
    showBrowserMessageNotification,
    showTestConversation,
    testConversationSummaries,
    testMessages,
  ]);

  const openHomeMessagePreview = React.useCallback(() => {
    if (!homeMessagePreview) return;

    const returnContext: ConversationReturnContext = {
      mode: "previous",
      recordDetail: null,
      recordSnapshot: null,
    };
    openTestConversation(
      homeMessagePreview.summary.conversationId,
      `test-${homeMessagePreview.message.id}`,
      returnContext
    );
  }, [homeMessagePreview, openTestConversation]);

  const createTestReply = React.useCallback((summary: TestConversationSummary, content: string) => {
    const reply = createTestReplyMessage(
      summary.conversationId,
      content,
      summary.conversationType
    );
    setTestMessages((prev) => {
      const nextMessages = [...prev, reply];
      persistTestMessages(nextMessages);
      return nextMessages;
    });
    markTestConversationAsRead(summary.conversationId);
    setTestConversationTargetUid(`test-${reply.id}`);
  }, [markTestConversationAsRead]);

  const openSourceConversation = React.useCallback(
    (source: RecordSourceConversation) => {
      const returnContext: ConversationReturnContext = {
        mode: "previous",
        recordDetail,
        recordSnapshot,
      };

      setRecordDetail(null);
      setRecordSnapshot(null);

      if (source.type === "ai" && typeof source.entryIndex === "number") {
        openAiConversation(source.entryIndex, returnContext);
        return;
      }

      if (source.type === "test" && source.conversationId) {
        openTestConversation(source.conversationId, source.recordUid ?? null, returnContext);
        return;
      }

      openSendToSelf(source.recordUid ?? null, returnContext);
    },
    [
      openAiConversation,
      openSendToSelf,
      openTestConversation,
      recordDetail,
      recordSnapshot,
    ]
  );

  const renderMainContent = () => {
    if (recordDetail) {
      return (
        <RecordFullDetailScreen
          record={recordDetail}
          extensionRecords={recordDetailExtensionRecords}
          onBack={() => setRecordDetail(null)}
          onCreateExtension={createRecordExtension}
          onOpenSource={openSourceConversation}
        />
      );
    }

    if (settingsView === "appearance") {
      return <AppearanceStyleScreen onBack={() => setSettingsView("settings")} />;
    }

    if (settingsView === "about") {
      return <AboutScreen onBack={() => setSettingsView(null)} />;
    }

    if (settingsView === "arrangement-ai") {
      return (
        <ArrangementAiSettingsScreen
          config={arrangementAiConfig}
          onBack={() => setSettingsView("settings")}
          onSave={(nextConfig) => {
            setArrangementAiConfig(nextConfig);
            persistArrangementAiConfig(nextConfig);
          }}
        />
      );
    }

    if (settingsView === "settings") {
      return (
        <SettingsScreen
          onBack={() => setSettingsView(null)}
          onOpenAppearance={() => setSettingsView("appearance")}
          onOpenArrangementAi={() => setSettingsView("arrangement-ai")}
          arrangementAiConfig={arrangementAiConfig}
        />
      );
    }

    if (showAiConversation) {
      return (
        <AiToolConversationChat
          onBack={handleConversationBack}
          targetIndex={aiConversationTargetIndex}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
        />
      );
    }

    if (showSendToSelf) {
      return (
        <SendToSelfConversationChat
          records={selfRecords}
          targetUid={sendToSelfTargetUid}
          onBack={handleConversationBack}
          onCreateRecord={createSelfRecord}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
        />
      );
    }

    if (showTestConversation && activeTestConversationSummary) {
      return (
        <TestIdentityConversationChat
          summary={activeTestConversationSummary}
          targetUid={testConversationTargetUid}
          onBack={handleConversationBack}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
          onCreateReply={(content) => createTestReply(activeTestConversationSummary, content)}
        />
      );
    }

    if (showAnswerGuide) {
      return <AnswerGuideChat onBack={backToDrawer} />;
    }

    if (showSearch) {
      return (
        <SearchScreen
          searchQuery={searchQuery}
          searchHistory={searchHistory}
          records={mineStatisticRecords}
          onChangeSearchQuery={setSearchQuery}
          onCommitSearch={commitSearchKeyword}
          onClose={() => {
            commitSearchKeyword(searchQuery);
            setShowSearch(false);
          }}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
          onOpenSourceConversation={openSourceConversation}
        />
      );
    }

    if (currentPage === "mine") {
      return (
        <MinePreview
          records={mineStatisticRecords}
          onOpenSettings={() => setSettingsView("settings")}
          onOpenAbout={() => setSettingsView("about")}
        />
      );
    }

    if (currentPage === "arrangements") {
      return (
        <ArrangementsPreview
          aiConfig={arrangementAiConfig}
          onOpenAiSettings={() => setSettingsView("arrangement-ai")}
        />
      );
    }

    if (currentPage === "insight") {
      return <InsightPreview />;
    }

    return (
      <div className="flex h-full flex-col bg-bg">
        <MobileHeader
          onMenuClick={() => setShowMenu(true)}
          onSearchClick={() => setShowSearch(true)}
          unreadCount={unreadAiConversationCount + unreadTestConversationCount}
        />
        {homeMessagePreview && (
          <div className="shrink-0 bg-bg px-4 pb-2">
            <HomeNewMessagePreview
              preview={homeMessagePreview}
              onOpen={openHomeMessagePreview}
            />
          </div>
        )}
        <Records
          compactHeader
          demoRecords={[...demoRecords, ...testDemoReplyRecords]}
          aiConversationEntries={aiConversationLogEntries}
          selfRecords={selfRecords}
          onCreateSelfRecord={createSelfRecord}
          onOpenSourceConversation={openSourceConversation}
          onOpenRecordDetail={setRecordDetail}
          onOpenRecordSnapshot={setRecordSnapshot}
        />
      </div>
    );
  };

  return (
    <AppShell
      mainPane={
        <div className="relative flex min-h-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-hidden">{renderMainContent()}</main>
          {!recordDetail && !showSearch && !showAnswerGuide && !showAiConversation && !showSendToSelf && !showTestConversation && !settingsView && (
            <MobileBottomNavigation currentPage={currentPage} onNavigate={onNavigate} />
          )}
          <MobileSideDrawer
            open={showMenu}
            onClose={() => setShowMenu(false)}
            onOpenAnswerGuide={() => {
              setShowMenu(false);
              setShowAnswerGuide(true);
            }}
            onOpenAiConversation={() => {
              openAiConversation(null);
            }}
            onOpenSendToSelf={() => {
              openSendToSelf(null);
            }}
            onOpenTestConversation={(conversationId) => {
              openTestConversation(conversationId);
            }}
            unreadAiConversationCount={unreadAiConversationCount}
            selfRecords={selfRecords}
            testConversations={testConversationSummaries}
          />
          <RecordDetailSheet
            record={recordSnapshot}
            onClose={() => setRecordSnapshot(null)}
            onOpenSource={openSourceConversation}
          />
        </div>
      }
    />
  );
}

function SearchScreen({
  searchQuery,
  searchHistory,
  records,
  onChangeSearchQuery,
  onCommitSearch,
  onClose,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
  onOpenSourceConversation,
}: {
  searchQuery: string;
  searchHistory: string[];
  records: RecordItem[];
  onChangeSearchQuery: (value: string) => void;
  onCommitSearch: (value: string) => void;
  onClose: () => void;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
  onOpenSourceConversation: (source: RecordSourceConversation) => void;
}) {
  const { resolvedTheme, t } = usePreferences();
  const [activeTab, setActiveTab] = React.useState<"records" | "topics">("records");
  const [activeQuickType, setActiveQuickType] = React.useState<QuickSearchType | null>(null);
  const keyword = searchQuery.trim().toLowerCase();
  const hasSearchCondition = keyword.length > 0 || activeQuickType !== null;
  const searchTags = React.useMemo(
    () =>
      t("search.defaultTags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [t]
  );
  const emptyImageSrc =
    resolvedTheme === "dark"
      ? "/images/image_search_empty.png"
      : "/images/image_search_empty_light.png";

  const filteredRecords = React.useMemo(
    () =>
      records.filter((record) => {
        const content = record.text_content.toLowerCase();
        const matchesKeyword = !keyword || content.includes(keyword);
        const matchesQuickType =
          activeQuickType === null || recordMatchesQuickType(record, activeQuickType);
        return matchesKeyword && matchesQuickType;
      }),
    [activeQuickType, keyword, records]
  );

  const topicGroups = React.useMemo(
    () => buildSearchTopicGroups(records, t).filter((topic) => {
      if (!keyword) return topic.count > 0;
      return (
        topic.title.toLowerCase().includes(keyword) ||
        topic.description.toLowerCase().includes(keyword)
      );
    }),
    [keyword, records, t]
  );

  const handleKeywordSelect = (value: string) => {
    setActiveQuickType(null);
    onChangeSearchQuery(value);
    onCommitSearch(value);
  };

  const handleQuickSearch = (type: QuickSearchType) => {
    setActiveQuickType(type);
    setActiveTab("records");
    onChangeSearchQuery("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="flex h-[50px] shrink-0 items-center bg-bg pl-2.5">
        <div className="relative min-w-0 flex-1">
          <input
            value={searchQuery}
            onChange={(event) => {
              onChangeSearchQuery(event.target.value);
              setActiveQuickType(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onCommitSearch(searchQuery);
                event.currentTarget.blur();
              }
            }}
            onBlur={() => onCommitSearch(searchQuery)}
            autoFocus
            placeholder={t("search.placeholder")}
            className="h-10 w-full rounded-[12px] bg-surface px-2.5 pr-12 text-[16px] leading-10 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-fill-2 text-text-tertiary transition active:scale-[0.94]"
              onClick={() => {
                onChangeSearchQuery("");
                setActiveQuickType(null);
              }}
              aria-label={t("search.clear")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 px-[19px] py-2 text-[16px] leading-6 text-text transition active:scale-[0.96]"
          onClick={onClose}
        >
          {t("search.cancel")}
        </button>
      </header>

      {!hasSearchCondition ? (
        <SearchLanding
          searchHistory={searchHistory}
          searchTags={searchTags}
          onKeywordSelect={handleKeywordSelect}
          onQuickSearch={handleQuickSearch}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <SearchTabs
            activeTab={activeTab}
            activeQuickType={activeQuickType}
            onChangeTab={setActiveTab}
            onClearQuickType={() => setActiveQuickType(null)}
          />
          {activeTab === "records" ? (
            filteredRecords.length > 0 ? (
              <ChatList
                records={filteredRecords}
                hasMore={false}
                loading={false}
                onLoadMore={() => undefined}
                onOpenSourceConversation={onOpenSourceConversation}
                onOpenRecordDetail={onOpenRecordDetail}
                onOpenRecordSnapshot={onOpenRecordSnapshot}
              />
            ) : (
              <SearchEmptyState
                imageSrc={emptyImageSrc}
                keyword={searchQuery || quickSearchLabel(activeQuickType, t)}
              />
            )
          ) : topicGroups.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                {topicGroups.map((topic) => (
                  <button
                    key={topic.key}
                    type="button"
                    className="flex min-h-[62px] w-full items-center rounded-[12px] bg-surface px-3 text-left transition active:scale-[0.99]"
                    onClick={() => handleKeywordSelect(topic.searchKeyword)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary">
                      {topic.icon}
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium leading-5 text-text">
                        {topic.title}
                      </p>
                      <p className="mt-1 truncate text-xs leading-4 text-text-tertiary">
                        {formatTemplate(t("search.topicCount"), {
                          count: String(topic.count),
                        })}
                      </p>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-text-disabled" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <SearchEmptyState imageSrc={emptyImageSrc} keyword={searchQuery} />
          )}
        </div>
      )}
    </div>
  );
}

function SearchLanding({
  searchHistory,
  searchTags,
  onKeywordSelect,
  onQuickSearch,
}: {
  searchHistory: string[];
  searchTags: string[];
  onKeywordSelect: (value: string) => void;
  onQuickSearch: (type: QuickSearchType) => void;
}) {
  const { t } = usePreferences();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-[22px]">
      {searchHistory.length > 0 && (
        <section className="pb-[22px]">
          <p className="mb-2 px-3 text-[12px] leading-4 text-text-tertiary">
            {t("search.recent")}
          </p>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {searchHistory.map((keyword) => (
              <SearchChip
                key={keyword}
                label={keyword}
                textClassName="text-text"
                onClick={() => onKeywordSelect(keyword)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mb-2 px-3 text-[12px] leading-4 text-text-tertiary">
          {t("search.quickSearch")}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {quickSearchTypes.map((type) => (
            <SearchChip
              key={type}
              label={quickSearchLabel(type, t)}
              textClassName="text-link"
              onClick={() => onQuickSearch(type)}
            />
          ))}
        </div>
      </section>

      {searchTags.length > 0 && (
        <section className="mt-[30px]">
          <p className="mb-2 px-3 text-[12px] leading-4 text-text-tertiary">
            {t("search.tags")}
          </p>
          <div className="flex flex-wrap gap-x-1.5 gap-y-1.5">
            {searchTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="px-2 py-[3px] text-[14px] leading-5 text-link transition active:scale-[0.97]"
                onClick={() => onKeywordSelect(tag.replace(/^#/, ""))}
              >
                {tag.startsWith("#") ? tag : `#${tag}`}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SearchTabs({
  activeTab,
  activeQuickType,
  onChangeTab,
  onClearQuickType,
}: {
  activeTab: "records" | "topics";
  activeQuickType: QuickSearchType | null;
  onChangeTab: (tab: "records" | "topics") => void;
  onClearQuickType: () => void;
}) {
  const { t } = usePreferences();
  const tabs: Array<{ key: "records" | "topics"; label: string }> = [
    { key: "records", label: t("search.tabRecords") },
    { key: "topics", label: t("search.tabTopics") },
  ];

  return (
    <div className="flex h-[30px] shrink-0 items-center bg-gray-8">
      <div className="ml-[18px] flex min-w-0 flex-1 items-center gap-[30px]">
        {tabs.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={cn(
                "relative h-[30px] px-0 pb-1 text-[14px] leading-[24px] transition",
                selected ? "font-semibold text-primary" : "font-normal text-text"
              )}
              onClick={() => onChangeTab(tab.key)}
            >
              {tab.label}
              {selected && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-2.5 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
      {activeQuickType && (
        <button
          type="button"
          className="mr-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-[12px] leading-5 text-primary transition active:scale-[0.96]"
          onClick={onClearQuickType}
        >
          {quickSearchLabel(activeQuickType, t)}
        </button>
      )}
      <button
        type="button"
        className="mr-[18px] flex h-[21px] w-[23px] items-center justify-center text-text-muted transition active:scale-[0.96]"
        aria-label={t("search.filter")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function SearchChip({
  label,
  textClassName,
  onClick,
}: {
  label: string;
  textClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 rounded-full border border-[var(--record-topic-border)] px-3 py-[3px] text-[14px] leading-5 transition active:scale-[0.97]",
        textClassName
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SearchEmptyState({ imageSrc, keyword }: { imageSrc: string; keyword: string }) {
  const { t } = usePreferences();
  const label = keyword.trim() || t("search.label");

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center px-4 pt-20 text-center">
      <div>
        <img src={imageSrc} alt="" className="mx-auto w-[140px]" aria-hidden="true" />
        <p className="mt-2.5 whitespace-pre-line text-[14px] leading-5 text-text-tertiary">
          {formatTemplate(t("search.noResult"), { keyword: label })}
        </p>
      </div>
    </div>
  );
}

function quickSearchLabel(type: QuickSearchType | null, t: (key: string) => string) {
  if (!type) return "";
  return t(`search.quick.${type}`);
}

function recordMatchesQuickType(record: RecordItem, type: QuickSearchType) {
  const content = record.text_content.toLowerCase();
  const sourceLabel = record.sourceConversation?.label.toLowerCase() ?? "";
  const combined = `${content} ${sourceLabel}`;

  switch (type) {
    case "image":
      return /鍥剧墖|鐓х墖|瑙嗛|image|photo|video/.test(combined);
    case "audio":
      return /璇煶|闊抽|褰曢煶|voice|audio|recording/.test(combined);
    case "link":
      return /閾炬帴|http|link|url/.test(combined);
    case "file":
      return /鏂囦欢|鏂囨。|file|document/.test(combined);
    case "longArticle":
      return Array.from(record.text_content).length >= 80;
    case "contact":
      return /鑱旂郴浜簗鍚屼簨|鍊欓€変汉|鐢ㄦ埛|ai|contact|user/.test(combined);
    default:
      return true;
  }
}

function buildSearchTopicGroups(records: RecordItem[], t: (key: string) => string) {
  const quickNotes = records.filter((record) => !record.sourceConversation);
  const selfNotes = records.filter((record) => record.sourceConversation?.type === "self");
  const aiNotes = records.filter((record) => record.sourceConversation?.type === "ai");

  return [
    {
      key: "quick",
      icon: t("search.topicQuickIcon"),
      title: t("records.title"),
      description: t("recordDetail.quickNoteSource"),
      count: quickNotes.length,
      searchKeyword: t("records.title"),
    },
    {
      key: "self",
      icon: t("sendToSelf.icon"),
      title: t("sendToSelf.title"),
      description: t("sendToSelf.privateTag"),
      count: selfNotes.length,
      searchKeyword: t("sendToSelf.title"),
    },
    {
      key: "ai",
      icon: "AI",
      title: t("ai.title"),
      description: t("ai.rounds"),
      count: aiNotes.length,
      searchKeyword: "AI",
    },
  ];
}

function MobileHeader({
  onMenuClick,
  onSearchClick,
  unreadCount,
}: {
  onMenuClick: () => void;
  onSearchClick: () => void;
  unreadCount: number;
}) {
  const { appIcon, resolvedTheme, t } = usePreferences();
  const logoSrc = getJiwoLogoSrc(appIcon, resolvedTheme);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-bg px-4">
      <button
        type="button"
        className="flex h-9 items-center gap-[2px] text-text transition active:scale-[0.96]"
        onClick={onMenuClick}
        aria-label={t("common.openMenu")}
      >
        <span className="flex h-9 w-5 items-center justify-center">
          <svg
            className="h-6 w-5"
            viewBox="0 0 20 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M5 6.25C5 5.55964 5.55964 5 6.25 5H12.75C13.4404 5 14 5.55964 14 6.25C14 6.94036 13.4404 7.5 12.75 7.5H6.25C5.55964 7.5 5 6.94036 5 6.25ZM5 12.25C5 11.5596 5.55964 11 6.25 11H15.75C16.4404 11 17 11.5596 17 12.25C17 12.9404 16.4404 13.5 15.75 13.5H6.25C5.55964 13.5 5 12.9404 5 12.25ZM6.25 17C5.55964 17 5 17.5596 5 18.25C5 18.9404 5.55964 19.5 6.25 19.5H9.75C10.4404 19.5 11 18.9404 11 18.25C11 17.5596 10.4404 17 9.75 17H6.25Z"
              fill="currentColor"
            />
          </svg>
        </span>
        {unreadCount > 0 && <UnreadBadge count={unreadCount} />}
        <img src={logoSrc} alt="" className="h-8 w-8" aria-hidden="true" />
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onSearchClick}
          aria-label={t("search.label")}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 25 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11.0969 19.0453C14.9754 19.0453 18.1196 15.9012 18.1196 12.0227C18.1196 8.14416 14.9754 5 11.0969 5C7.21838 5 4.07422 8.14416 4.07422 12.0227C4.07422 15.9012 7.21838 19.0453 11.0969 19.0453ZM11.0969 21.0453C16.08 21.0453 20.1196 17.0058 20.1196 12.0227C20.1196 7.03959 16.08 3 11.0969 3C6.11381 3 2.07422 7.03959 2.07422 12.0227C2.07422 17.0058 6.11381 21.0453 11.0969 21.0453Z"
              fill="currentColor"
            />
            <path
              d="M16.8203 17.8184L19.7295 20.7282"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

function HomeNewMessagePreview({
  preview,
  onOpen,
}: {
  preview: HomeMessagePreview;
  onOpen: () => void;
}) {
  const { t } = usePreferences();
  const unreadLabel = formatUnreadCount(preview.unreadCount);

  return (
    <button
      type="button"
      className="flex w-full items-center rounded-[16px] border border-border-light bg-surface px-3 py-2.5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition hover:bg-[var(--record-card-hover-bg)] active:scale-[0.99] dark:shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
      onClick={onOpen}
      aria-label={t("homeMessagePreview.label") + "：" + preview.summary.title}
    >
      <AvatarUnreadWrap unreadCount={preview.unreadCount}>
        <TestConversationAvatar summary={preview.summary} className="h-[34px] w-[34px]" />
      </AvatarUnreadWrap>
      <div className="ml-3 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-[14px] font-medium leading-5 text-text">
              {preview.summary.title}
            </p>
            <span className="shrink-0 rounded-full bg-primary-soft px-2 py-[2px] text-[10px] font-medium leading-3 text-primary">
              {t("homeMessagePreview.label")}
            </span>
          </div>
          <span className="shrink-0 text-[11px] leading-4 text-text-tertiary">
            {formatBubbleTime(preview.message.sentAt)}
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs leading-4 text-text-muted">
            {preview.message.text}
          </p>
          <span className="shrink-0 text-[11px] leading-4 text-primary">
            {unreadLabel}
            {t("common.unreadCount")}
          </span>
        </div>
      </div>
      <svg
        className="ml-2 h-4 w-4 shrink-0 text-text-tertiary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

function getLatestRecord(records: RecordItem[]) {
  return records.reduce<RecordItem | null>((latest, record) => {
    if (!latest || record.send_at > latest.send_at) return record;
    return latest;
  }, null);
}

function MobileSideDrawer({
  open,
  onClose,
  onOpenAnswerGuide,
  onOpenAiConversation,
  onOpenSendToSelf,
  onOpenTestConversation,
  unreadAiConversationCount,
  selfRecords,
  testConversations,
}: {
  open: boolean;
  onClose: () => void;
  onOpenAnswerGuide: () => void;
  onOpenAiConversation: () => void;
  onOpenSendToSelf: () => void;
  onOpenTestConversation: (conversationId: string) => void;
  unreadAiConversationCount: number;
  selfRecords: RecordItem[];
  testConversations: TestConversationSummary[];
}) {
  const { t } = usePreferences();
  const latestSelfRecord = React.useMemo(
    () => getLatestRecord(selfRecords),
    [selfRecords]
  );
  const latestAiEntry = aiConversationLogEntries.at(-1);
  const latestAiTime = latestAiEntry
    ? parseAiConversationTimestamp(latestAiEntry.timestamp, 0)
    : 0;
  const conversationItems = React.useMemo(
    () =>
      [
        {
          key: "self",
          latestAt: latestSelfRecord?.send_at ?? 0,
          node: (
            <SendToSelfDrawerItem
              records={selfRecords}
              latestRecord={latestSelfRecord}
              onClick={onOpenSendToSelf}
            />
          ),
        },
        {
          key: "ai",
          latestAt: latestAiTime,
          node: (
            <AiToolConversationItem
              onClick={onOpenAiConversation}
              unreadCount={unreadAiConversationCount}
              latestAt={latestAiTime}
            />
          ),
        },
        ...testConversations.map((summary) => ({
          key: `test-${summary.conversationId}`,
          latestAt: summary.latestMessage.sentAt,
          node: (
            <TestConversationDrawerItem
              summary={summary}
              onClick={() => onOpenTestConversation(summary.conversationId)}
            />
          ),
        })),
      ].sort((a, b) => b.latestAt - a.latestAt),
    [
      latestAiTime,
      latestSelfRecord,
      onOpenAiConversation,
      onOpenSendToSelf,
      onOpenTestConversation,
      selfRecords,
      testConversations,
      unreadAiConversationCount,
    ]
  );

  return (
    <div
      className={cn(
        "absolute inset-x-0 -top-9 z-50 h-[calc(100%+36px)] transition",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-overlay-light transition-opacity duration-150 ease-out",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-label={t("drawer.closeMask")}
      />
      <aside
        className={cn(
          "absolute left-0 top-0 flex h-full w-[296px] max-w-[82%] flex-col bg-surface px-4 pb-4 pt-[52px] shadow-[8px_0_32px_rgba(0,0,0,0.12)] transition-transform duration-[180ms] ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-label={t("drawer.label")}
      >
        <h2 className="-mx-1 px-3 pb-[5px] pt-[3px] text-xl font-semibold leading-[1.2] text-text">
          {t("drawer.title")}
        </h2>

        <nav className="-mx-4 mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pb-3">
          <GuideConversationItem onClick={onOpenAnswerGuide} />
          {conversationItems.map((item) => (
            <React.Fragment key={item.key}>{item.node}</React.Fragment>
          ))}
        </nav>

        <div className="mt-auto rounded-[12px] bg-bg px-3 py-3">
          <p className="text-xs font-semibold text-text">{t("drawer.footerTitle")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
            {t("drawer.footerDesc")}
          </p>
        </div>
      </aside>
    </div>
  );
}

function SendToSelfDrawerItem({
  records,
  latestRecord,
  onClick,
}: {
  records: RecordItem[];
  latestRecord: RecordItem | null;
  onClick: () => void;
}) {
  const { t } = usePreferences();

  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <SendToSelfIcon className="h-[30px] w-[30px] shrink-0" />
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center">
            <p className="truncate text-[16px] font-normal leading-6 text-text">
              {t("sendToSelf.title")}
            </p>
            <OverviewEntryTag label={t("sendToSelf.privateTag")} />
          </div>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {latestRecord
              ? formatBubbleTime(latestRecord.send_at)
              : formatRoundCount(records.length, t("sendToSelf.recordCount"))}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {latestRecord?.text_content ?? t("sendToSelf.emptyPreview")}
        </p>
      </div>
    </button>
  );
}

function GuideConversationItem({ onClick }: { onClick: () => void }) {
  const { t } = usePreferences();

  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#E9F6F1] text-[11px] font-semibold text-primary">
        {t("guide.avatar")}
      </div>
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-medium leading-5 text-text">
            {t("guide.title")}
          </p>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {t("guide.pinned")}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {t("guide.subtitle")}
        </p>
      </div>
    </button>
  );
}

function AvatarUnreadWrap({
  unreadCount,
  children,
}: {
  unreadCount: number;
  children: React.ReactNode;
}) {
  const label = formatUnreadCount(unreadCount);

  return (
    <span className="relative shrink-0">
      {children}
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-primary text-[10px] font-normal leading-none text-on-primary",
            label.length > 1 ? "px-[4px]" : "px-0"
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}

function AiToolConversationItem({
  onClick,
  unreadCount,
  latestAt,
}: {
  onClick: () => void;
  unreadCount: number;
  latestAt: number;
}) {
  const { t } = usePreferences();
  const latestEntry = aiConversationLogEntries.at(-1);

  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <AvatarUnreadWrap unreadCount={unreadCount}>
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">
          AI
        </div>
      </AvatarUnreadWrap>
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-medium leading-5 text-text">
            {t("ai.title")}
          </p>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {latestAt > 0
              ? formatBubbleTime(latestAt)
              : `${aiConversationLogEntries.length}${t("ai.rounds")}`}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {latestEntry?.userInput ?? t("ai.emptyTitle")}
        </p>
      </div>
    </button>
  );
}

function TestConversationDrawerItem({
  summary,
  onClick,
}: {
  summary: TestConversationSummary;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center px-4 py-2.5 text-left transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <AvatarUnreadWrap unreadCount={summary.unreadCount}>
        <TestConversationAvatar summary={summary} className="h-[30px] w-[30px]" />
      </AvatarUnreadWrap>
      <div className="ml-[7px] min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-medium leading-5 text-text">
            {summary.title}
          </p>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {formatBubbleTime(summary.latestMessage.sentAt)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
          {summary.conversationType === "group" &&
          summary.latestMessage.sender === "identity"
            ? (summary.memberIdentities.find(
                (identity) => identity.id === summary.latestMessage.identityId
              )?.name ?? "成员") +
              "：" +
              summary.latestMessage.text
            : summary.latestMessage.text}
        </p>
      </div>
    </button>
  );
}

function UnreadBadge({ count }: { count: number }) {
  const { t } = usePreferences();
  const label = formatUnreadCount(count);

  return (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-normal leading-[14px] text-on-primary",
        label.length > 1 ? "px-[5px]" : "px-0"
      )}
      aria-label={`${label}${t("common.unreadCount")}`}
    >
      {label}
    </span>
  );
}

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function AiToolConversationChat({
  onBack,
  targetIndex,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
}: {
  onBack: () => void;
  targetIndex?: number | null;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
}) {
  const { t } = usePreferences();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const entryRefs = React.useRef<Array<HTMLElement | null>>([]);
  const fallbackBaseTime = React.useMemo(() => Date.now(), []);

  const makeUserInputRecord = React.useCallback(
    (entry: (typeof aiConversationLogEntries)[number], index: number): RecordItem => {
      const timestamp = parseAiConversationTimestamp(
        entry.timestamp,
        fallbackBaseTime + index
      );
      return {
        uid: `ai-conversation-user-${index}`,
        text_content: entry.userInput,
        send_at: timestamp,
        create_at: timestamp,
        update_at: timestamp,
        sourceConversation: {
          type: "ai",
          label: t("ai.title"),
          actionLabel: t("records.openSource"),
          iconLabel: "AI",
          entryIndex: index,
        },
      };
    },
    [fallbackBaseTime, t]
  );

  React.useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (targetIndex !== null && targetIndex !== undefined) {
      entryRefs.current[targetIndex]?.scrollIntoView({
        block: "center",
      });
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [targetIndex]);

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">
            AI
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-5 text-text">
              {t("ai.title")}
            </h1>
            <p className="mt-0.5 text-[11px] leading-3 text-text-tertiary">
              {formatRoundCount(aiConversationLogEntries.length, t("ai.rounds"))}
            </p>
          </div>
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-5 pt-4"
      >
        {aiConversationLogEntries.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-sm font-semibold text-primary">
                AI
              </div>
              <p className="mt-4 text-sm font-semibold text-text">
                {t("ai.emptyTitle")}
              </p>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                {t("ai.emptyDesc")}
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-0 space-y-6">
            {aiConversationLogEntries.map((entry, index) => (
              <section
                key={`${entry.timestamp}-${index}`}
                ref={(node) => {
                  entryRefs.current[index] = node;
                }}
                className={cn(
                  "min-w-0 scroll-mt-4 space-y-3 transition-colors duration-300",
                  targetIndex === index && "-m-1 rounded-[18px] bg-primary-soft/70 p-1"
                )}
              >
                <div className="flex justify-center">
                  <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-text-tertiary">
                    {entry.timestamp}
                  </span>
                </div>

                <div className="flex min-w-0 justify-end gap-2">
                  <div className="-mx-4 min-w-0 flex-1">
                    {(() => {
                      const userInputRecord = makeUserInputRecord(entry, index);
                      return (
                        <ChatBubble
                          textContent={userInputRecord.text_content}
                          disableAnimation
                          variant="primary"
                          onOpenDetail={() => onOpenRecordDetail(userInputRecord)}
                          onOpenMemorySnapshot={() =>
                            onOpenRecordSnapshot(userInputRecord)
                          }
                        />
                      );
                    })()}
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">
                    AI
                  </div>
                  <div className="min-w-0 max-w-[82%]">
                    <p className="mb-1 px-1 text-[11px] leading-4 text-text-tertiary">
                      {t("ai.output")}
                    </p>
                    <div className="max-w-full rounded-[14px] rounded-tl-[4px] bg-surface px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.55] text-text [overflow-wrap:anywhere]">
                        {entry.aiFinalOutput}
                      </p>
                    </div>

                    <div className="mt-2 min-w-0 max-w-full rounded-[10px] bg-surface-muted px-3 py-2">
                      <p className="text-[11px] font-semibold leading-4 text-text">
                        {t("ai.changedFiles")}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {entry.changedFiles.map((file) => (
                          <li key={file} className="break-words text-[11px] leading-4 text-text-muted [overflow-wrap:anywhere]">
                            {file}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[11px] font-semibold leading-4 text-text">
                        {t("ai.verification")}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {entry.verification.map((item) => (
                          <li key={item} className="break-words text-[11px] leading-4 text-text-muted [overflow-wrap:anywhere]">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SendToSelfConversationChat({
  records,
  targetUid,
  onBack,
  onCreateRecord,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
}: {
  records: RecordItem[];
  targetUid?: string | null;
  onBack: () => void;
  onCreateRecord: (content: string) => void;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
}) {
  const { t } = usePreferences();
  const recordsWithoutSource = React.useMemo(
    () => records.map(({ sourceConversation: _sourceConversation, ...record }) => record),
    [records]
  );

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <SendToSelfIcon className="h-[30px] w-[30px] shrink-0" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center">
              <h1 className="truncate text-[18px] font-normal leading-6 text-text">
                {t("sendToSelf.title")}
              </h1>
              <OverviewEntryTag label={t("sendToSelf.privateTag")} />
            </div>
            <p className="mt-0.5 text-[11px] leading-3 text-text-tertiary">
              {formatRoundCount(records.length, t("sendToSelf.recordCount"))}
            </p>
          </div>
        </div>
      </header>

      <ChatList
        records={recordsWithoutSource}
        hasMore={false}
        loading={false}
        onLoadMore={() => undefined}
        targetRecordUid={targetUid}
        onOpenRecordDetail={onOpenRecordDetail}
        onOpenRecordSnapshot={onOpenRecordSnapshot}
      />
      <ChatInput
        onSubmit={onCreateRecord}
        onVoiceSubmit={() => onCreateRecord(t("records.voiceRecord"))}
      />
    </div>
  );
}

function TestIdentityConversationChat({
  summary,
  targetUid,
  onBack,
  onOpenRecordDetail,
  onOpenRecordSnapshot,
  onCreateReply,
}: {
  summary: TestConversationSummary;
  targetUid?: string | null;
  onBack: () => void;
  onOpenRecordDetail: (record: RecordItem) => void;
  onOpenRecordSnapshot: (record: RecordItem) => void;
  onCreateReply: (content: string) => void;
}) {
  const { resolvedLocale, t } = usePreferences();
  const candidateProfile = useCandidateProfile();
  const selfDisplayName = candidateProfile?.name || t("recordDetail.me");
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const recordRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const sortedRecords = React.useMemo(
    () => [...summary.records].sort((a, b) => a.send_at - b.send_at),
    [summary.records]
  );

  React.useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (targetUid) {
      recordRefs.current.get(targetUid)?.scrollIntoView({ block: "center" });
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [sortedRecords.length, targetUid]);

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <TestConversationAvatar summary={summary} className="h-8 w-8" />
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-5 text-text">
              {summary.title}
            </h1>
            <p className="mt-0.5 truncate text-[11px] leading-3 text-text-tertiary">
              {summary.subtitle}
            </p>
          </div>
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4"
      >
        <div className="space-y-3">
          {sortedRecords.map((record, index) => {
            const prevRecord = sortedRecords[index - 1];
            const showTime =
              index === 0 || shouldShowConversationTime(prevRecord.send_at, record.send_at);

            return (
              <div
                key={record.uid}
                ref={(node) => {
                  if (node) {
                    recordRefs.current.set(record.uid, node);
                  } else {
                    recordRefs.current.delete(record.uid);
                  }
                }}
                className={cn(
                  "scroll-mt-4",
                  targetUid === record.uid && "rounded-[18px] bg-primary-soft/70 py-1"
                )}
              >
                {showTime && (
                  <div className="mb-3 flex justify-center">
                    <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-text-tertiary">
                      {formatTimeLabel(record.send_at, {
                        locale: resolvedLocale,
                        today: t("time.today"),
                        yesterday: t("time.yesterday"),
                        dayBeforeYesterday: t("time.dayBeforeYesterday"),
                      })}{" "}
                      {formatBubbleTime(record.send_at)}
                    </span>
                  </div>
                )}
                {record.sender === "demo" ? (
                  <div className="-mx-4">
                    <ChatBubble
                      textContent={record.text_content}
                      disableAnimation
                      variant="primary"
                      topLabel={
                        summary.conversationType === "group" ? selfDisplayName : undefined
                      }
                      onOpenDetail={() => onOpenRecordDetail(record)}
                      onOpenMemorySnapshot={() => onOpenRecordSnapshot(record)}
                    />
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <TestMessageIdentityAvatar
                      identityId={record.identityId}
                      summary={summary}
                    />
                    <div className="min-w-0 max-w-[82%]">
                      {summary.conversationType === "group" && (
                        <p className="mb-1 px-1 text-[11px] leading-4 text-text-tertiary">
                          {summary.memberIdentities.find(
                            (identity) => identity.id === record.identityId
                          )?.name ?? "群成员"}
                        </p>
                      )}
                      <button
                        type="button"
                        className="max-w-full rounded-[14px] rounded-tl-[4px] bg-surface px-3.5 py-2.5 text-left text-text shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-[var(--record-card-hover-bg)] active:scale-[0.99]"
                        onClick={() => onOpenRecordDetail(record)}
                      >
                        <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.55]">
                          {record.text_content}
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <ChatInput
        onSubmit={onCreateReply}
        onVoiceSubmit={() => onCreateReply(t("records.voiceRecord"))}
      />
    </div>
  );
}

function shouldShowConversationTime(prevSendAt: number, currentSendAt: number) {
  return Math.abs(currentSendAt - prevSendAt) > 1000 * 60 * 5;
}

function TestIdentityAvatar({
  identity,
  className,
}: {
  identity: TestIdentity;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none text-white",
        className
      )}
      style={{ backgroundColor: identity.color }}
      aria-hidden="true"
    >
      {identity.avatarLabel}
    </div>
  );
}

function TestConversationAvatar({
  summary,
  className,
}: {
  summary: TestConversationSummary;
  className?: string;
}) {
  if (summary.identity) {
    return <TestIdentityAvatar identity={summary.identity} className={className} />;
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none text-white",
        className
      )}
      style={{ backgroundColor: summary.color }}
      aria-hidden="true"
    >
      {summary.avatarLabel}
    </div>
  );
}

function TestMessageIdentityAvatar({
  identityId,
  summary,
}: {
  identityId: string;
  summary: TestConversationSummary;
}) {
  const identity =
    summary.memberIdentities.find((item) => item.id === identityId) ?? summary.identity;

  if (identity) {
    return <TestIdentityAvatar identity={identity} className="mt-0.5 h-8 w-8" />;
  }

  return <TestConversationAvatar summary={summary} className="mt-0.5 h-8 w-8" />;
}

function AnswerGuideChat({ onBack }: { onBack: () => void }) {
  const { resolvedLocale, t } = usePreferences();
  const guideTime = React.useMemo(() => Date.now(), []);
  const answerGuideMessages = [
    t("guide.message1"),
    t("guide.message2"),
    t("guide.message3"),
    t("guide.message4"),
    t("guide.message5"),
  ];

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9F6F1] text-xs font-semibold text-primary">
            {t("guide.avatar")}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-5 text-text">
              {t("guide.title")}
            </h1>
            <p className="mt-0.5 text-[11px] leading-3 text-text-tertiary">
              {t("guide.scope")}
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
        <div className="mb-4 flex justify-center">
          <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-text-tertiary">
            {formatTimeLabel(guideTime, {
              locale: resolvedLocale,
              today: t("time.today"),
              yesterday: t("time.yesterday"),
              dayBeforeYesterday: t("time.dayBeforeYesterday"),
            })}{" "}
            {formatBubbleTime(guideTime)}
          </span>
        </div>
        <div className="space-y-3">
          {answerGuideMessages.map((message, index) => (
            <div key={message} className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9F6F1] text-xs font-semibold text-primary">
                {t("guide.avatar")}
              </div>
              <div className="max-w-[78%]">
                <div className="rounded-[14px] rounded-tl-[4px] bg-surface px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-text">
                    {message}
                  </p>
                </div>
                {index === 0 && (
                  <p className="mt-1 px-1 text-[11px] leading-4 text-text-tertiary">
                    {t("guide.title")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileBottomNavigation({
  currentPage,
  onNavigate,
}: {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
}) {
  const { t } = usePreferences();

  return (
    <nav className="shrink-0 bg-bg px-2 pb-3 pt-1">
      <div className="flex h-12 items-center">
        {tabs.map((tab) => {
          const active = tab.key === currentPage;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onNavigate(tab.key)}
              className={cn(
                "flex h-full flex-1 items-center justify-center rounded-[10px] text-base transition active:scale-[0.98]",
                active
                  ? "font-semibold text-text"
                  : "font-normal text-text-tertiary"
              )}
            >
              {getTabLabel(tab.key, t)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ArrangementsPreview({
  aiConfig,
  onOpenAiSettings,
}: {
  aiConfig: ArrangementAiConfig;
  onOpenAiSettings: () => void;
}) {
  const [arrangements, setArrangements] = React.useState(getInitialArrangements);
  const [showForm, setShowForm] = React.useState(false);
  const [showAiRecognizer, setShowAiRecognizer] = React.useState(false);
  const [activeArrangementId, setActiveArrangementId] = React.useState<string | null>(null);
  const [editingArrangementId, setEditingArrangementId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [scheduledTime, setScheduledTime] = React.useState("");
  const [kind, setKind] = React.useState<ArrangementKind>("task");
  const [priority, setPriority] = React.useState<ArrangementPriority>("normal");
  const [location, setLocation] = React.useState("");
  const [participantsText, setParticipantsText] = React.useState("");
  const [tagsText, setTagsText] = React.useState("");
  const [checklistText, setChecklistText] = React.useState("");
  const [completionCriteria, setCompletionCriteria] = React.useState("");
  const [sourceType, setSourceType] = React.useState<ArrangementSourceType>("manual");
  const [sourceLabel, setSourceLabel] = React.useState(defaultArrangementSource.label);
  const [sourceText, setSourceText] = React.useState("");
  const [saveHint, setSaveHint] = React.useState("");
  const [aiInputText, setAiInputText] = React.useState("");
  const [aiResult, setAiResult] = React.useState<ArrangementAiRecognitionResult | null>(null);
  const [aiError, setAiError] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);
  const [pendingMergeTargetUids, setPendingMergeTargetUids] = React.useState<string[]>([]);
  const [pendingSuggestedStatus, setPendingSuggestedStatus] = React.useState<ArrangementStatus | null>(null);
  const [pendingOptimizationSummary, setPendingOptimizationSummary] = React.useState("");
  const [pendingAiAction, setPendingAiAction] = React.useState<ArrangementAiAction | null>(null);
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  const activeArrangement =
    arrangements.find((arrangement) => arrangement.uid === activeArrangementId) ?? null;
  const editingArrangement =
    arrangements.find((arrangement) => arrangement.uid === editingArrangementId) ?? null;
  const canSubmit = title.trim().length > 0 && content.trim().length > 0;
  const canSubmitAiRecognition = aiInputText.trim().length > 0 && !aiLoading;
  const hasReadyAiConfig = isArrangementAiConfigReady(aiConfig);
  const todoCount = arrangements.filter((item) => item.status === "todo").length;
  const expiredCount = arrangements.filter((item) => item.status === "expired").length;
  const pausedCount = arrangements.filter((item) => item.status === "paused").length;
  const completedCount = arrangements.filter((item) => item.status === "completed").length;
  const pendingMergeTargets = React.useMemo(
    () =>
      pendingMergeTargetUids
        .map((uid) => arrangements.find((arrangement) => arrangement.uid === uid) ?? null)
        .filter((arrangement): arrangement is ArrangementItem => Boolean(arrangement)),
    [arrangements, pendingMergeTargetUids]
  );
  const aiResultTargetTitles = React.useMemo(() => {
    if (!aiResult) return [];

    return dedupeArrangementTextList(
      [aiResult.targetUid, ...aiResult.targetUids]
        .map((uid) => arrangements.find((arrangement) => arrangement.uid === uid)?.title ?? "")
        .filter(Boolean)
    );
  }, [aiResult, arrangements]);
  const sortedArrangements = React.useMemo(
    () =>
      [...arrangements].sort((a, b) => {
        const statusRank: Record<ArrangementStatus, number> = {
          todo: 0,
          paused: 1,
          completed: 2,
          expired: 3,
        };
        const rankDiff = statusRank[a.status] - statusRank[b.status];
        if (rankDiff !== 0) return rankDiff;

        const timeA = a.scheduledAt ?? Number.MAX_SAFE_INTEGER;
        const timeB = b.scheduledAt ?? Number.MAX_SAFE_INTEGER;
        if (timeA !== timeB) return timeA - timeB;

        return b.updateAt - a.updateAt;
      }),
    [arrangements]
  );

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const now = Date.now();
    const nextArrangements = arrangements.map((arrangement) =>
      arrangement.status === "todo" && arrangement.scheduledAt !== null && arrangement.scheduledAt < now
        ? { ...arrangement, status: "expired" as ArrangementStatus, updateAt: now }
        : arrangement
    );

    if (nextArrangements.some((arrangement, index) => arrangement !== arrangements[index])) {
      persistNextArrangements(nextArrangements);
    }
  }, [arrangements, nowTick]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setScheduledTime("");
    setKind("task");
    setPriority("normal");
    setLocation("");
    setParticipantsText("");
    setTagsText("");
    setChecklistText("");
    setCompletionCriteria("");
    setSourceType("manual");
    setSourceLabel(defaultArrangementSource.label);
    setSourceText("");
    setPendingMergeTargetUids([]);
    setPendingSuggestedStatus(null);
    setPendingOptimizationSummary("");
    setPendingAiAction(null);
    setEditingArrangementId(null);
  };

  const persistNextArrangements = (nextArrangements: ArrangementItem[]) => {
    setArrangements(nextArrangements);
    persistArrangements(nextArrangements);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
    setShowAiRecognizer(false);
    setActiveArrangementId(null);
    setSaveHint("");
  };

  const resetAiRecognizer = () => {
    setAiInputText("");
    setAiResult(null);
    setAiError("");
    setAiLoading(false);
  };

  const openAiRecognizerWithInput = (initialText: string) => {
    resetAiRecognizer();
    setAiInputText(initialText.trim());
    setShowForm(false);
    setShowAiRecognizer(true);
    setActiveArrangementId(null);
    setSaveHint("");
  };

  const createAiDraftFromInput = async (rawInput: string) => {
    const nextInput = rawInput.trim();
    if (!nextInput) return;

    if (!hasReadyAiConfig) {
      openAiRecognizerWithInput(nextInput);
      return;
    }

    setAiInputText(nextInput);
    setAiError("");
    setAiResult(null);
    setAiLoading(true);

    try {
      const result = await recognizeArrangementFromText(aiConfig, nextInput, arrangements);
      setAiResult(result);
      if (
        result.action === "create" ||
        (!result.targetUid && result.targetUids.length === 0)
      ) {
        openAiDraftForm(result, nextInput);
      } else {
        openAiOptimizationForm(result, nextInput);
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI 璇嗗埆澶辫触锛岃绋嶅悗閲嶈瘯");
      setShowForm(false);
      setShowAiRecognizer(true);
      setActiveArrangementId(null);
    } finally {
      setAiLoading(false);
    }
  };

  const openAiOptimizationForm = (
    result: ArrangementAiRecognitionResult,
    sourceOriginalText: string
  ) => {
    const targetUids = dedupeArrangementTextList(
      [result.targetUid, ...result.targetUids].filter(Boolean)
    );
    const targets = targetUids
      .map((uid) => arrangements.find((arrangement) => arrangement.uid === uid) ?? null)
      .filter((arrangement): arrangement is ArrangementItem => Boolean(arrangement));

    if (targets.length === 0) {
      openAiDraftForm(result, sourceOriginalText);
      return;
    }

    const primaryTarget = targets[0];
    const parsedScheduledAt =
      parseArrangementScheduledTime(result.scheduledAt) ??
      inferScheduledAtFromNaturalLanguage(result.scheduledAtText || sourceOriginalText) ??
      primaryTarget.scheduledAt;
    const mergedParticipants = dedupeArrangementTextList([
      ...targets.flatMap((item) => item.participants),
      ...result.participants,
    ]);
    const mergedTags = dedupeArrangementTextList([
      ...targets.flatMap((item) => item.tags),
      ...result.tags,
    ]);

    setTitle(result.title || primaryTarget.title);
    setContent(result.content || primaryTarget.content);
    setScheduledTime(toDateTimeLocalValue(parsedScheduledAt));
    setKind(result.kind || primaryTarget.kind);
    setPriority(result.priority || primaryTarget.priority);
    setLocation(result.location || primaryTarget.location);
    setParticipantsText(formatArrangementTextList(mergedParticipants));
    setTagsText(formatArrangementTextList(mergedTags));
    setChecklistText(primaryTarget.checklist.map((item) => item.text).join("\n"));
    setCompletionCriteria(result.completionCriteria || primaryTarget.completionCriteria);
    setSourceType("text");
    setSourceLabel("\u0041\u0049\u6587\u672c\u8bc6\u522b");
    setSourceText(sourceOriginalText);
    setPendingMergeTargetUids(targets.map((item) => item.uid));
    setPendingSuggestedStatus(result.action === "complete" ? "completed" : null);
    setPendingOptimizationSummary(result.optimizationSummary || result.notes);
    setPendingAiAction(result.action);
    setEditingArrangementId(primaryTarget.uid);
    setShowAiRecognizer(false);
    setShowForm(true);
    setActiveArrangementId(null);
    setSaveHint(
      result.action === "complete"
        ? "\u0041\u0049\u5efa\u8bae\u5c06\u8fd9\u6761\u5b89\u6392\u6807\u8bb0\u4e3a\u5b8c\u6210\uff0c\u8bf7\u786e\u8ba4\u540e\u4fdd\u5b58\u3002"
        : targets.length > 1
          ? "\u0041\u0049\u5efa\u8bae\u5c06\u76f8\u5173\u5b89\u6392\u8fdb\u884c\u5408\u5e76\u4e0e\u91cd\u65b0\u89c4\u5212\uff0c\u8bf7\u786e\u8ba4\u540e\u4fdd\u5b58\u3002"
          : "\u0041\u0049\u5efa\u8bae\u66f4\u65b0\u539f\u6709\u5b89\u6392\uff0c\u8bf7\u786e\u8ba4\u540e\u4fdd\u5b58\u3002"
    );
  };

  const openEditForm = (arrangement: ArrangementItem) => {
    setTitle(arrangement.title);
    setContent(arrangement.content);
    setScheduledTime(toDateTimeLocalValue(arrangement.scheduledAt));
    setKind(arrangement.kind);
    setPriority(arrangement.priority);
    setLocation(arrangement.location);
    setParticipantsText(formatArrangementTextList(arrangement.participants));
    setTagsText(formatArrangementTextList(arrangement.tags));
    setChecklistText(arrangement.checklist.map((item) => item.text).join("\n"));
    setCompletionCriteria(arrangement.completionCriteria);
    setSourceType(arrangement.sources[0]?.type ?? arrangement.source.type);
    setSourceLabel(arrangement.sources[0]?.label ?? arrangement.source.label);
    setSourceText(arrangement.sources[0]?.text ?? arrangement.source.text);
    setPendingMergeTargetUids([arrangement.uid]);
    setPendingSuggestedStatus(null);
    setPendingOptimizationSummary("");
    setPendingAiAction(null);
    setEditingArrangementId(arrangement.uid);
    setShowForm(true);
    setShowAiRecognizer(false);
    setSaveHint("");
  };

  const openAiDraftForm = (
    result: ArrangementAiRecognitionResult,
    sourceOriginalText = aiInputText.trim()
  ) => {
    resetForm();
    setTitle(result.title);
    setContent(result.content);
    const parsedScheduledAt =
      parseArrangementScheduledTime(result.scheduledAt) ??
      inferScheduledAtFromNaturalLanguage(result.scheduledAtText || sourceOriginalText);
    setScheduledTime(toDateTimeLocalValue(parsedScheduledAt));
    setKind(result.kind);
    setPriority(result.priority);
    setLocation(result.location);
    setParticipantsText(formatArrangementTextList(result.participants));
    setTagsText(formatArrangementTextList(result.tags));
    setCompletionCriteria(result.completionCriteria);
    setSourceType("text");
    setSourceLabel("\u0041\u0049\u6587\u672c\u8bc6\u522b");
    setSourceText(sourceOriginalText);
    setPendingOptimizationSummary(result.optimizationSummary || result.notes);
    setPendingAiAction(result.action);
    setShowAiRecognizer(false);
    setShowForm(true);
    setActiveArrangementId(null);
    setSaveHint(
      parsedScheduledAt === null && result.scheduledAtText
        ? "\u5df2\u751f\u6210\u5b89\u6392\u8349\u7a3f\uff0c\u8bf7\u8865\u5145\u5177\u4f53\u65f6\u95f4\u540e\u4fdd\u5b58\u3002"
        : "\u5df2\u751f\u6210\u5b89\u6392\u8349\u7a3f\uff0c\u8bf7\u786e\u8ba4\u5185\u5bb9\u540e\u4fdd\u5b58\u3002"
    );
  };

  const updateArrangement = (
    uid: string,
    updater: (arrangement: ArrangementItem) => ArrangementItem
  ) => {
    persistNextArrangements(
      arrangements.map((arrangement) =>
        arrangement.uid === uid ? updater(arrangement) : arrangement
      )
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const now = Date.now();
    const scheduledAt = parseArrangementScheduledTime(scheduledTime);
    const participants = parseArrangementTextList(participantsText);
    const tags = parseArrangementTextList(tagsText);
    const checklist = parseArrangementChecklist(checklistText, now);
    const normalizedLocation = location.trim();
    const normalizedCompletionCriteria = completionCriteria.trim();
    const normalizedSourceText = sourceText.trim();
    const nextSource: ArrangementSource = {
      type: sourceType,
      label: sourceLabel.trim() || defaultArrangementSource.label,
      text: normalizedSourceText,
    };
    const nextOpenStatus = getOpenArrangementStatus(scheduledAt, now);
    const nextAiSummary = pendingOptimizationSummary.trim();

    if (editingArrangement) {
      const relatedTargets = dedupeArrangementTextList(
        pendingMergeTargetUids.length > 0
          ? pendingMergeTargetUids
          : [editingArrangement.uid]
      )
        .map((uid) => arrangements.find((arrangement) => arrangement.uid === uid) ?? null)
        .filter((arrangement): arrangement is ArrangementItem => Boolean(arrangement));
      const primaryTarget = relatedTargets[0] ?? editingArrangement;
      const secondaryTargetUids = new Set(
        relatedTargets
          .slice(1)
          .map((arrangement) => arrangement.uid)
      );
      const mergedSources = dedupeArrangementSources([
        nextSource,
        ...relatedTargets.flatMap((arrangement) => arrangement.sources),
      ]);
      const nextMergeGroupId =
        relatedTargets.length > 1
          ? relatedTargets.find((arrangement) => arrangement.mergeGroupId)?.mergeGroupId ??
            `merge-${now}`
          : primaryTarget.mergeGroupId;
      const nextStatus =
        pendingSuggestedStatus === "completed"
          ? "completed"
          : primaryTarget.status === "todo" || primaryTarget.status === "expired"
            ? nextOpenStatus
            : primaryTarget.status;
      const nextAiAction = pendingAiAction ?? primaryTarget.aiAction;
      const nextAiRelatedArrangementTitles =
        sourceType === "text"
          ? dedupeArrangementTextList(
              relatedTargets.map((arrangement) => arrangement.title)
            )
          : primaryTarget.aiRelatedArrangementTitles;
      const nextArrangements = arrangements
        .filter((arrangement) => !secondaryTargetUids.has(arrangement.uid))
        .map((arrangement) =>
          arrangement.uid === primaryTarget.uid
            ? {
                ...arrangement,
                title: title.trim(),
                content: content.trim(),
                kind,
                priority,
                location: normalizedLocation,
                participants,
                tags,
                checklist,
                completionCriteria: normalizedCompletionCriteria,
                source: { ...nextSource },
                sources: mergedSources,
                mergeGroupId: nextMergeGroupId,
                scheduledAt,
                status: nextStatus,
                completedAt: nextStatus === "completed" ? now : null,
                pausedAt: nextStatus === "paused" ? now : null,
                aiAction: nextAiAction,
                aiSummary:
                  sourceType === "text"
                    ? nextAiSummary || primaryTarget.aiSummary
                    : primaryTarget.aiSummary,
                aiRelatedArrangementTitles: nextAiRelatedArrangementTitles,
                aiProcessedAt:
                  sourceType === "text"
                    ? now
                    : primaryTarget.aiProcessedAt,
                updateAt: now,
              }
            : arrangement
        );
      persistNextArrangements(nextArrangements);
      setSaveHint(
        pendingSuggestedStatus === "completed"
          ? "\u5df2\u6309 AI \u5efa\u8bae\u66f4\u65b0\u5b89\u6392\u72b6\u6001\uff0c\u8bf7\u5728\u5217\u8868\u4e2d\u7ee7\u7eed\u786e\u8ba4\u3002"
          : relatedTargets.length > 1
            ? "\u5df2\u6839\u636e AI \u5efa\u8bae\u5408\u5e76\u5e76\u91cd\u65b0\u89c4\u5212\u76f8\u5173\u5b89\u6392\u3002"
            : "\u5df2\u6839\u636e AI \u5efa\u8bae\u66f4\u65b0\u539f\u6709\u5b89\u6392\u3002"
      );
    } else {
      const nextArrangement: ArrangementItem = {
        uid: `arrangement-${now}-${Math.random().toString(36).slice(2, 8)}`,
        title: title.trim(),
        content: content.trim(),
        kind,
        priority,
        location: normalizedLocation,
        participants,
        tags,
        checklist,
        completionCriteria: normalizedCompletionCriteria,
        source: {
          ...nextSource,
        },
        sources: [nextSource],
        mergeGroupId: null,
        scheduledAt,
        status: nextOpenStatus,
        completedAt: null,
        pausedAt: null,
        aiAction: sourceType === "text" ? pendingAiAction ?? "create" : null,
        aiSummary: sourceType === "text" ? nextAiSummary : "",
        aiRelatedArrangementTitles: [],
        aiProcessedAt: sourceType === "text" ? now : null,
        createAt: now,
        updateAt: now,
      };
      persistNextArrangements([nextArrangement, ...arrangements]);
      setSaveHint("\u5b89\u6392\u5df2\u4fdd\u5b58\u5230\u5217\u8868\u3002");
    }

    resetForm();
    setShowForm(false);
  };

  const changeStatus = (uid: string, status: ArrangementStatus) => {
    const now = Date.now();
    updateArrangement(uid, (arrangement) => ({
      ...arrangement,
      status: status === "todo" ? getOpenArrangementStatus(arrangement.scheduledAt, now) : status,
      completedAt: status === "completed" ? now : null,
      pausedAt: status === "paused" ? now : null,
      updateAt: now,
    }));
  };

  const deleteArrangement = (uid: string) => {
    if (typeof window !== "undefined") {
      const target = arrangements.find((arrangement) => arrangement.uid === uid);
      const confirmed = window.confirm(
        target
          ? "确认删除“" + target.title + "”吗？删除后无法恢复。"
          : "确认删除这条安排吗？"
      );
      if (!confirmed) return;
    }

    const nextArrangements = arrangements.filter((arrangement) => arrangement.uid !== uid);
    persistNextArrangements(nextArrangements);
    if (activeArrangementId === uid) {
      setActiveArrangementId(null);
    }
    if (editingArrangementId === uid) {
      resetForm();
      setShowForm(false);
    }
    setSaveHint("安排已删除");
  };

  const handleAiRecognize = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmitAiRecognition || !hasReadyAiConfig) return;

    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    try {
      const enhancedResult = await recognizeArrangementFromText(
        aiConfig,
        aiInputText.trim(),
        arrangements
      );
      setAiResult(enhancedResult);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "璇嗗埆澶辫触锛岃绋嶅悗閲嶈瘯");
    } finally {
      setAiLoading(false);
    }
  };

  if (activeArrangement) {
    return (
      <ArrangementDetailView
        arrangement={activeArrangement}
        isEditing={showForm && editingArrangementId === activeArrangement.uid}
        title={title}
        content={content}
        scheduledTime={scheduledTime}
        kind={kind}
        priority={priority}
        location={location}
        participantsText={participantsText}
        tagsText={tagsText}
        checklistText={checklistText}
        completionCriteria={completionCriteria}
        sourceText={sourceText}
        canSubmit={canSubmit}
        onBack={() => {
          setActiveArrangementId(null);
          setShowForm(false);
          resetForm();
        }}
        onEdit={() => openEditForm(activeArrangement)}
        onSubmit={handleSubmit}
        onCancelEdit={() => {
          setShowForm(false);
          resetForm();
        }}
        onTitleChange={setTitle}
        onContentChange={setContent}
        onScheduledTimeChange={setScheduledTime}
        onKindChange={setKind}
        onPriorityChange={setPriority}
        onLocationChange={setLocation}
        onParticipantsTextChange={setParticipantsText}
        onTagsTextChange={setTagsText}
        onChecklistTextChange={setChecklistText}
        onCompletionCriteriaChange={setCompletionCriteria}
        onSourceTextChange={setSourceText}
        onComplete={() => changeStatus(activeArrangement.uid, "completed")}
        onPause={() => changeStatus(activeArrangement.uid, "paused")}
        onRestore={() => changeStatus(activeArrangement.uid, "todo")}
        onDelete={() => deleteArrangement(activeArrangement.uid)}
        relatedArrangementTitles={activeArrangement.aiRelatedArrangementTitles.filter(
          (title) => title !== activeArrangement.title
        )}
      />
    );
  }

  if (showAiRecognizer) {
    return (
      <ArrangementAiRecognizerView
        aiConfig={aiConfig}
        inputText={aiInputText}
        result={aiResult}
        errorMessage={aiError}
        isLoading={aiLoading}
        canSubmit={canSubmitAiRecognition}
        isConfigured={hasReadyAiConfig}
        canCreateDraft={Boolean(aiResult)}
        targetArrangementTitles={aiResultTargetTitles}
        onBack={() => {
          setShowAiRecognizer(false);
          resetAiRecognizer();
        }}
        onCreateDraft={() => {
          if (!aiResult) return;
          if (
            aiResult.action === "create" ||
            (!aiResult.targetUid && aiResult.targetUids.length === 0)
          ) {
            openAiDraftForm(aiResult, aiInputText.trim());
          } else {
            openAiOptimizationForm(aiResult, aiInputText.trim());
          }
        }}
        onOpenSettings={onOpenAiSettings}
        onInputChange={setAiInputText}
        onSubmit={handleAiRecognize}
      />
    );
  }

  if (showForm) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ArrangementPageHeader
          title={
            editingArrangement
              ? "\u7f16\u8f91\u5b89\u6392"
              : sourceType === "text"
                ? "\u786e\u8ba4\u8349\u7a3f"
                : "\u6dfb\u52a0\u5b89\u6392"
          }
          onBack={() => {
            setShowForm(false);
            resetForm();
          }}
          rightAction={
            <button
              type="submit"
              form="arrangement-create-form"
              disabled={!canSubmit}
              className="flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold text-primary transition hover:bg-hover-overlay active:scale-[0.96] disabled:opacity-35"
            >
              {"\u4fdd\u5b58"}
            </button>
          }
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-2">
          <article className="rounded-[12px] border border-[var(--record-card-border)] bg-[var(--record-card-bg)] px-3 py-4 shadow-[var(--mine-card-shadow)]">
            {sourceType === "text" && (
              <div className="mb-3 rounded-[12px] bg-primary-soft px-3 py-3 text-sm leading-6 text-primary">
                <p>
                  {saveHint ||
                    "\u8fd9\u662f\u4e00\u6761\u7531 AI \u6587\u672c\u8bc6\u522b\u751f\u6210\u7684\u5b89\u6392\u8349\u7a3f\uff0c\u4fdd\u5b58\u524d\u53ef\u4ee5\u7ee7\u7eed\u4fee\u6539\u3002"}
                </p>
                {pendingOptimizationSummary && (
                  <p className="mt-1 text-xs leading-5 text-primary/80">
                    {pendingOptimizationSummary}
                  </p>
                )}
                {pendingMergeTargets.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs leading-5 text-primary/80">
                      {pendingSuggestedStatus === "completed"
                        ? "AI 当前关联到的安排："
                        : pendingMergeTargets.length > 1
                          ? "AI 建议联动处理的安排："
                          : "AI 当前关联到的原有安排："}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {pendingMergeTargets.map((item) => (
                        <span
                          key={item.uid}
                          className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium leading-4 text-primary"
                        >
                          {item.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <ArrangementForm
              formId="arrangement-create-form"
              title={title}
              content={content}
              scheduledTime={scheduledTime}
              kind={kind}
              priority={priority}
              location={location}
              participantsText={participantsText}
              tagsText={tagsText}
              checklistText={checklistText}
              completionCriteria={completionCriteria}
              sourceText={sourceText}
              canSubmit={canSubmit}
              submitLabel={"\u4fdd\u5b58"}
              showActions={false}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                resetForm();
              }}
              onTitleChange={setTitle}
              onContentChange={setContent}
              onScheduledTimeChange={setScheduledTime}
              onKindChange={setKind}
              onPriorityChange={setPriority}
              onLocationChange={setLocation}
              onParticipantsTextChange={setParticipantsText}
              onTagsTextChange={setTagsText}
              onChecklistTextChange={setChecklistText}
              onCompletionCriteriaChange={setCompletionCriteria}
              onSourceTextChange={setSourceText}
            />
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ArrangementPageHeader
        title={"\u5b89\u6392"}
        rightAction={
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-text transition hover:bg-hover-overlay active:scale-[0.96]"
            onClick={openCreateForm}
            aria-label={"\u624b\u52a8\u6dfb\u52a0\u5b89\u6392"}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        }
      />
      <header className="hidden">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-text">安排</h1>
          <p className="mt-0.5 truncate text-xs leading-4 text-text-muted">
            把接下来要落地的事情放在这里
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 pt-2">
        {showForm && (
          <section className="rounded-[12px] border border-[var(--record-card-border)] bg-[var(--record-card-bg)] px-3 py-3 shadow-[var(--mine-card-shadow)]">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-5 text-text">快速新建安排</p>
                <p className="mt-1 truncate text-xs leading-4 text-text-tertiary">
                  先补充标题、内容和时间
                </p>
              </div>
            </div>
            <ArrangementForm
              title={title}
              content={content}
              scheduledTime={scheduledTime}
              kind={kind}
              priority={priority}
              location={location}
              participantsText={participantsText}
              tagsText={tagsText}
              checklistText={checklistText}
              completionCriteria={completionCriteria}
              sourceText={sourceText}
              canSubmit={canSubmit}
              submitLabel="保存"
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                resetForm();
              }}
              onTitleChange={setTitle}
              onContentChange={setContent}
              onScheduledTimeChange={setScheduledTime}
              onKindChange={setKind}
              onPriorityChange={setPriority}
              onLocationChange={setLocation}
              onParticipantsTextChange={setParticipantsText}
              onTagsTextChange={setTagsText}
              onChecklistTextChange={setChecklistText}
              onCompletionCriteriaChange={setCompletionCriteria}
              onSourceTextChange={setSourceText}
            />
          </section>
        )}

        {saveHint && !showForm && (
          <p className="mb-3 rounded-[10px] bg-primary-soft px-3 py-2 text-xs leading-4 text-primary">
            {saveHint}
          </p>
        )}

        {!showForm && sortedArrangements.length > 0 ? (
          <section className={cn("space-y-2.5", showForm && "mt-3")}>
            <div className="flex items-center gap-2 px-1 text-xs leading-5 text-text-tertiary">
              <span>{"\u5f85\u5904\u7406"} {todoCount}</span>
              <span>/</span>
              <span>{"\u5df2\u8fc7\u671f"} {expiredCount}</span>
              <span>/</span>
              <span>{"\u6682\u7f13"} {pausedCount}</span>
              <span>/</span>
              <span>{"\u5b8c\u6210"} {completedCount}</span>
            </div>
            {sortedArrangements.map((arrangement) => (
              <ArrangementCard
                key={arrangement.uid}
                arrangement={arrangement}
                now={nowTick}
                onOpen={() => setActiveArrangementId(arrangement.uid)}
              />
            ))}
          </section>
        ) : !showForm ? (
          <section className={cn("flex min-h-[256px] items-center justify-center rounded-[12px] border border-dashed border-border bg-surface px-7 text-center", showForm && "mt-3")}>
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 7h8M8 12h5M8 17h4" />
                  <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                </svg>
              </div>
              <h2 className="mt-4 text-[15px] font-semibold leading-5 text-text">
                还没有安排              </h2>
              <p className="mt-2 text-xs leading-5 text-text-muted">
                点击下方文字输入，或使用右上角按钮手动添加安排。              </p>
            </div>
          </section>
        ) : null}
      </div>
      {!showForm && (
        <ChatInput
          onSubmit={createAiDraftFromInput}
          onVoiceSubmit={() => {
            setSaveHint("\u8bed\u97f3\u8bc6\u522b\u5c06\u4f5c\u4e3a\u540e\u7eed\u6269\u5c55\u63a5\u5165\uff0c\u5f53\u524d\u8bf7\u5148\u4f7f\u7528\u6587\u5b57\u8f93\u5165\u3002");
          }}
          idleLabel="单击文字，长按语音"
          textPlaceholder="输入安排内容，例如：下周一晚上约大家吃饭"
          isSubmitting={aiLoading}
          submittingLabel="正在识别安排..."
        />
      )}
    </div>
  );
}

function ArrangementForm({
  formId,
  title,
  content,
  scheduledTime,
  kind,
  priority,
  location,
  participantsText,
  tagsText,
  checklistText,
  completionCriteria,
  sourceText,
  canSubmit,
  submitLabel,
  showActions = true,
  onSubmit,
  onCancel,
  onTitleChange,
  onContentChange,
  onScheduledTimeChange,
  onKindChange,
  onPriorityChange,
  onLocationChange,
  onParticipantsTextChange,
  onTagsTextChange,
  onChecklistTextChange,
  onCompletionCriteriaChange,
  onSourceTextChange,
}: {
  formId?: string;
  title: string;
  content: string;
  scheduledTime: string;
  kind: ArrangementKind;
  priority: ArrangementPriority;
  location: string;
  participantsText: string;
  tagsText: string;
  checklistText: string;
  completionCriteria: string;
  sourceText: string;
  canSubmit: boolean;
  submitLabel: string;
  showActions?: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onScheduledTimeChange: (value: string) => void;
  onKindChange: (value: ArrangementKind) => void;
  onPriorityChange: (value: ArrangementPriority) => void;
  onLocationChange: (value: string) => void;
  onParticipantsTextChange: (value: string) => void;
  onTagsTextChange: (value: string) => void;
  onChecklistTextChange: (value: string) => void;
  onCompletionCriteriaChange: (value: string) => void;
  onSourceTextChange: (value: string) => void;
}) {
  const [dateValue = "", timeValue = ""] = scheduledTime.split("T");
  const applyDateAndTime = (nextDate: string, nextTime: string) => {
    if (!nextDate) {
      onScheduledTimeChange("");
      return;
    }

    onScheduledTimeChange(nextDate + "T" + (nextTime || "09:00"));
  };
  const applyQuickTime = (timestamp: number) => {
    onScheduledTimeChange(toDateTimeLocalValue(timestamp));
  };
  const now = new Date();
  const todayEvening = new Date(now);
  todayEvening.setHours(18, 0, 0, 0);
  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);

  return (
    <form id={formId} className="mt-4 space-y-3" onSubmit={onSubmit}>
      <label className="block">
        <span className="text-xs font-medium leading-4 text-text-muted">标题</span>
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="例如：确认周会材料"
          className="mt-1.5 h-11 w-full rounded-[12px] border border-transparent bg-surface px-3 text-[15px] leading-5 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium leading-4 text-text-muted">内容</span>
        <textarea
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="补充要处理的事项、背景或下一步动作"
          rows={3}
          className="mt-1.5 block min-h-[92px] w-full resize-none rounded-[12px] border border-transparent bg-surface px-3 py-2.5 text-[15px] leading-6 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-medium leading-4 text-text-muted">类型</span>
          <select
            value={kind}
            onChange={(event) => onKindChange(event.target.value as ArrangementKind)}
            className="mt-1.5 h-11 w-full rounded-[12px] border border-transparent bg-surface px-3 text-[15px] leading-5 text-text outline-none transition focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
          >
            {arrangementKindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium leading-4 text-text-muted">重要性</span>
          <select
            value={priority}
            onChange={(event) => onPriorityChange(event.target.value as ArrangementPriority)}
            className="mt-1.5 h-11 w-full rounded-[12px] border border-transparent bg-surface px-3 text-[15px] leading-5 text-text outline-none transition focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
          >
            {arrangementPriorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-medium leading-4 text-text-muted">地点</span>
          <input
            value={location}
            onChange={(event) => onLocationChange(event.target.value)}
            placeholder="如：医院、公司"
            className="mt-1.5 h-11 w-full rounded-[12px] border border-transparent bg-surface px-3 text-[15px] leading-5 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium leading-4 text-text-muted">相关人</span>
          <input
            value={participantsText}
            onChange={(event) => onParticipantsTextChange(event.target.value)}
            placeholder="用顿号或逗号分隔"
            className="mt-1.5 h-11 w-full rounded-[12px] border border-transparent bg-surface px-3 text-[15px] leading-5 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium leading-4 text-text-muted">标签</span>
        <input
          value={tagsText}
          onChange={(event) => onTagsTextChange(event.target.value)}
          placeholder="如：健康、工作、家庭"
          className="mt-1.5 h-11 w-full rounded-[12px] border border-transparent bg-surface px-3 text-[15px] leading-5 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium leading-4 text-text-muted">时间</span>
        <div className="mt-1.5 grid grid-cols-[1.35fr_1fr] gap-2">
          <input
            type="date"
            value={dateValue}
            onChange={(event) => applyDateAndTime(event.target.value, timeValue)}
            className="h-11 min-w-0 rounded-[12px] border border-transparent bg-surface px-3 text-[15px] leading-5 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
          />
          <input
            type="time"
            value={timeValue}
            onChange={(event) => applyDateAndTime(dateValue, event.target.value)}
            className="h-11 min-w-0 rounded-[12px] border border-transparent bg-surface px-3 text-[15px] leading-5 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="h-9 rounded-[10px] bg-surface-subtle px-2 text-xs font-medium text-text transition active:scale-[0.97]"
            onClick={() => applyQuickTime(todayEvening.getTime())}
          >
            今天 18:00
          </button>
          <button
            type="button"
            className="h-9 rounded-[10px] bg-surface-subtle px-2 text-xs font-medium text-text transition active:scale-[0.97]"
            onClick={() => applyQuickTime(tomorrowMorning.getTime())}
          >
            明天 09:00
          </button>
          <button
            type="button"
            className="h-9 rounded-[10px] bg-surface-subtle px-2 text-xs font-medium text-text transition active:scale-[0.97]"
            onClick={() => applyQuickTime(getNextFriday())}
          >
            周五 18:00
          </button>
          <button
            type="button"
            className="h-9 rounded-[10px] bg-surface-subtle px-2 text-xs font-medium text-text-tertiary transition active:scale-[0.97]"
            onClick={() => onScheduledTimeChange("")}
          >
            不设时间
          </button>
        </div>
      </label>

      <label className="block">
        <span className="text-xs font-medium leading-4 text-text-muted">清单</span>
        <textarea
          value={checklistText}
          onChange={(event) => onChecklistTextChange(event.target.value)}
          placeholder="每行一项，例如：预约、准备材料、出门"
          rows={3}
          className="mt-1.5 block min-h-[88px] w-full resize-none rounded-[12px] border border-transparent bg-surface px-3 py-2.5 text-[15px] leading-6 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium leading-4 text-text-muted">完成依据</span>
        <textarea
          value={completionCriteria}
          onChange={(event) => onCompletionCriteriaChange(event.target.value)}
          placeholder="写清怎样算完成，便于后续自动判断状态"
          rows={2}
          className="mt-1.5 block min-h-[72px] w-full resize-none rounded-[12px] border border-transparent bg-surface px-3 py-2.5 text-[15px] leading-6 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium leading-4 text-text-muted">来源文本</span>
        <textarea
          value={sourceText}
          onChange={(event) => onSourceTextChange(event.target.value)}
          placeholder="手动创建可留空；后续文本识别会写入原文"
          rows={2}
          className="mt-1.5 block min-h-[72px] w-full resize-none rounded-[12px] border border-transparent bg-surface px-3 py-2.5 text-[15px] leading-6 text-text outline-none transition placeholder:text-input-placeholder focus:bg-input-bg-focus focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
        />
      </label>

      {showActions && (
        <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          className="h-10 rounded-[10px] px-3 text-sm font-medium text-text-tertiary transition active:scale-[0.97]"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-10 rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-primary transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {submitLabel}
        </button>
      </div>
      )}
    </form>
  );
}

function ArrangementCard({
  arrangement,
  now,
  onOpen,
}: {
  arrangement: ArrangementItem;
  now: number;
  onOpen: () => void;
}) {
  const countdownLabel = formatArrangementCountdown(arrangement.scheduledAt, now);
  const countdownClass = getArrangementCountdownClass(
    arrangement.status,
    arrangement.priority,
    arrangement.scheduledAt,
    now
  );
  const showKind = shouldShowArrangementKind(arrangement.kind);
  const showPriority = shouldShowArrangementPriority(arrangement.priority);
  const showLocation = arrangement.location.trim().length > 0;
  const metadataTags = [
    showKind ? getArrangementKindLabel(arrangement.kind) : null,
    showPriority ? getArrangementPriorityLabel(arrangement.priority) : null,
    showLocation ? arrangement.location : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 3);

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-[12px] border px-3 py-3 text-left shadow-[var(--mine-card-shadow)] transition active:scale-[0.99]",
        getArrangementStatusCardClass(arrangement.status),
        arrangement.status === "completed" && "opacity-70"
      )}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                getArrangementStatusDotClass(arrangement.status)
              )}
            />
            <h2
              className={cn(
                "min-w-0 truncate text-[17px] font-semibold leading-6 text-text",
                arrangement.status === "completed" && "line-through decoration-text-tertiary"
              )}
            >
              {arrangement.title}
            </h2>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[14px] leading-5 text-text">
            {arrangement.content}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {metadataTags.map((tag) => {
              const isPriorityTag =
                showPriority && tag === getArrangementPriorityLabel(arrangement.priority);
              return (
                <span
                  key={tag}
                  className={cn(
                    "max-w-[140px] truncate rounded-full px-2.5 py-1 text-[12px] leading-4",
                    isPriorityTag
                      ? getArrangementPriorityPillClass(arrangement.priority)
                      : "bg-surface-subtle text-text-tertiary"
                  )}
                >
                  {tag}
                </span>
              );
            })}
          </div>
          {countdownLabel && (
            <p className={cn("mt-2 text-[13px] font-semibold leading-5", countdownClass)}>
              {countdownLabel}
            </p>
          )}
        </div>
        <span className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium leading-4",
          getArrangementStatusPillClass(arrangement.status)
        )}>
          {getArrangementStatusLabel(arrangement.status)}
        </span>
      </div>
    </button>
  );
}

function ArrangementPageHeader({
  title,
  onBack,
  rightAction,
}: {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}) {
  return (
    <header className="grid h-[50px] shrink-0 grid-cols-[72px_1fr_72px] items-center bg-bg px-2">
      {onBack ? (
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={onBack}
          aria-label={"\u8fd4\u56de"}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      ) : (
        <div className="h-10 w-[72px]" aria-hidden="true" />
      )}
      <h1 className="min-w-0 truncate text-center text-[18px] font-medium leading-none text-text">
        {title}
      </h1>
      <div className="flex h-10 w-[72px] items-center justify-end justify-self-end">
        {rightAction}
      </div>
    </header>
  );
}

function ArrangementDetailView({
  arrangement,
  relatedArrangementTitles,
  isEditing,
  title,
  content,
  scheduledTime,
  kind,
  priority,
  location,
  participantsText,
  tagsText,
  checklistText,
  completionCriteria,
  sourceText,
  canSubmit,
  onBack,
  onEdit,
  onSubmit,
  onCancelEdit,
  onTitleChange,
  onContentChange,
  onScheduledTimeChange,
  onKindChange,
  onPriorityChange,
  onLocationChange,
  onParticipantsTextChange,
  onTagsTextChange,
  onChecklistTextChange,
  onCompletionCriteriaChange,
  onSourceTextChange,
  onComplete,
  onPause,
  onRestore,
  onDelete,
}: {
  arrangement: ArrangementItem;
  relatedArrangementTitles: string[];
  isEditing: boolean;
  title: string;
  content: string;
  scheduledTime: string;
  kind: ArrangementKind;
  priority: ArrangementPriority;
  location: string;
  participantsText: string;
  tagsText: string;
  checklistText: string;
  completionCriteria: string;
  sourceText: string;
  canSubmit: boolean;
  onBack: () => void;
  onEdit: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onScheduledTimeChange: (value: string) => void;
  onKindChange: (value: ArrangementKind) => void;
  onPriorityChange: (value: ArrangementPriority) => void;
  onLocationChange: (value: string) => void;
  onParticipantsTextChange: (value: string) => void;
  onTagsTextChange: (value: string) => void;
  onChecklistTextChange: (value: string) => void;
  onCompletionCriteriaChange: (value: string) => void;
  onSourceTextChange: (value: string) => void;
  onComplete: () => void;
  onPause: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-bg">
      <ArrangementPageHeader
        title={isEditing ? "\u7f16\u8f91\u5b89\u6392" : "\u5b89\u6392\u8be6\u60c5"}
        onBack={isEditing ? onCancelEdit : onBack}
        rightAction={
          isEditing ? (
            <button
              type="submit"
              form="arrangement-detail-edit-form"
              disabled={!canSubmit}
              className="flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold text-primary transition hover:bg-hover-overlay active:scale-[0.96] disabled:opacity-35"
            >
              {"\u4fdd\u5b58"}
            </button>
          ) : null
        }
      />
      <header className="hidden">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-text transition hover:bg-hover-overlay active:scale-[0.96]"
          onClick={isEditing ? onCancelEdit : onBack}
          aria-label={isEditing ? "取消编辑" : "返回"}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[18px] font-medium leading-none text-text">
          安排详情
        </h1>
        {isEditing ? (
          <button
            type="submit"
            form="arrangement-detail-edit-form"
            disabled={!canSubmit}
            className="flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold text-primary transition hover:bg-hover-overlay active:scale-[0.96] disabled:opacity-35"
          >
            保存
          </button>
        ) : (
          <div className="h-10 w-10" aria-hidden="true" />
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-2">
        <article className="rounded-[12px] border border-[var(--record-card-border)] bg-[var(--record-card-bg)] px-3 py-4 shadow-[var(--mine-card-shadow)]">
          {isEditing ? (
            <ArrangementForm
              formId="arrangement-detail-edit-form"
              title={title}
              content={content}
              scheduledTime={scheduledTime}
              kind={kind}
              priority={priority}
              location={location}
              participantsText={participantsText}
              tagsText={tagsText}
              checklistText={checklistText}
              completionCriteria={completionCriteria}
              sourceText={sourceText}
              canSubmit={canSubmit}
              submitLabel="保存"
              showActions={false}
              onSubmit={onSubmit}
              onCancel={onCancelEdit}
              onTitleChange={onTitleChange}
              onContentChange={onContentChange}
              onScheduledTimeChange={onScheduledTimeChange}
              onKindChange={onKindChange}
              onPriorityChange={onPriorityChange}
              onLocationChange={onLocationChange}
              onParticipantsTextChange={onParticipantsTextChange}
              onTagsTextChange={onTagsTextChange}
              onChecklistTextChange={onChecklistTextChange}
              onCompletionCriteriaChange={onCompletionCriteriaChange}
              onSourceTextChange={onSourceTextChange}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 flex-1 text-[18px] font-semibold leading-6 text-text">
                  {arrangement.title}
                </h2>
                <span className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium leading-4",
                  getArrangementStatusPillClass(arrangement.status)
                )}>
                  {getArrangementStatusLabel(arrangement.status)}
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-[1.7] text-text">
                {arrangement.content}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs leading-4 text-text-tertiary">
                  {getArrangementKindLabel(arrangement.kind)}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium leading-4",
                    getArrangementPriorityPillClass(arrangement.priority)
                  )}
                >
                  {getArrangementPriorityLabel(arrangement.priority)}
                </span>
                {arrangement.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary-soft px-2.5 py-1 text-xs leading-4 text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {arrangement.checklist.length > 0 && (
                <section className="mt-4 rounded-[12px] bg-surface px-3 py-3">
                  <h3 className="text-xs font-medium leading-4 text-text-tertiary">清单</h3>
                  <div className="mt-2 space-y-2">
                    {arrangement.checklist.map((item) => (
                      <div key={item.uid} className="flex items-start gap-2 text-sm leading-5">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary text-[10px] text-primary">
                          {item.completed ? "✓" : ""}
                        </span>
                        <span className="min-w-0 flex-1 text-text">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <div className="mt-4 space-y-2 border-t border-border-light pt-3 text-sm leading-5">
                <ArrangementDetailRow
                  label="安排时间"
                  value={formatArrangementDateTime(arrangement.scheduledAt)}
                />
                <ArrangementDetailRow
                  label="地点"
                  value={arrangement.location || "未填写"}
                />
                <ArrangementDetailRow
                  label="相关人"
                  value={
                    arrangement.participants.length > 0
                      ? formatArrangementTextList(arrangement.participants)
                      : "未填写"
                  }
                />
                <ArrangementDetailRow
                  label="完成依据"
                  value={arrangement.completionCriteria || "未填写"}
                />
                <ArrangementDetailRow
                  label="来源"
                  value={
                    arrangement.sources
                      .map((source) =>
                        source.text ? source.label + "：" + source.text : source.label
                      )
                      .join("；")
                  }
                />
                {arrangement.aiAction && (
                  <ArrangementDetailRow
                    label="AI处理"
                    value={
                      arrangement.aiSummary
                        ? `${getArrangementAiActionLabel(arrangement.aiAction)}：${arrangement.aiSummary}`
                        : getArrangementAiActionLabel(arrangement.aiAction)
                    }
                  />
                )}
                {relatedArrangementTitles.length > 0 && (
                  <ArrangementDetailRow
                    label="关联安排"
                    value={formatArrangementTextList(relatedArrangementTitles)}
                  />
                )}
                <ArrangementDetailRow
                  label="创建时间"
                  value={formatArrangementDateTime(arrangement.createAt)}
                />
                <ArrangementDetailRow
                  label="更新时间"
                  value={formatArrangementDateTime(arrangement.updateAt)}
                />
                {arrangement.completedAt && (
                  <ArrangementDetailRow
                    label="完成时间"
                    value={formatArrangementDateTime(arrangement.completedAt)}
                  />
                )}
                {arrangement.pausedAt && (
                  <ArrangementDetailRow
                    label="暂缓时间"
                    value={formatArrangementDateTime(arrangement.pausedAt)}
                  />
                )}
              </div>
            </>
          )}
        </article>

        {!isEditing && (
          <section className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-11 rounded-[10px] bg-primary text-sm font-semibold text-on-primary transition active:scale-[0.97] disabled:opacity-35"
              onClick={arrangement.status === "completed" ? onRestore : onComplete}
            >
              {arrangement.status === "completed" ? "恢复待处理" : "完成安排"}
            </button>
            <button
              type="button"
              className="h-11 rounded-[10px] bg-surface text-sm font-medium text-text transition active:scale-[0.97] disabled:opacity-35"
              onClick={arrangement.status === "paused" ? onRestore : onPause}
            >
              {arrangement.status === "paused" ? "恢复待处理" : "暂缓处理"}
            </button>
            <button
              type="button"
              className="h-11 rounded-[10px] bg-surface text-sm font-medium text-text transition active:scale-[0.97]"
              onClick={onEdit}
            >
              编辑
            </button>
            <button
              type="button"
              className="h-11 rounded-[10px] bg-rose-50 text-sm font-medium text-rose-700 transition active:scale-[0.97] dark:bg-rose-950/50 dark:text-rose-300"
              onClick={onDelete}
            >
              删除
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function ArrangementDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-[72px] shrink-0 text-text-tertiary">{label}</span>
      <span className="min-w-0 flex-1 text-text">{value}</span>
    </div>
  );
}

function ArrangementAiRecognizerView({
  aiConfig,
  inputText,
  result,
  targetArrangementTitles,
  errorMessage,
  isLoading,
  canSubmit,
  isConfigured,
  canCreateDraft,
  onBack,
  onCreateDraft,
  onOpenSettings,
  onInputChange,
  onSubmit,
}: {
  aiConfig: ArrangementAiConfig;
  inputText: string;
  result: ArrangementAiRecognitionResult | null;
  targetArrangementTitles: string[];
  errorMessage: string;
  isLoading: boolean;
  canSubmit: boolean;
  isConfigured: boolean;
  canCreateDraft: boolean;
  onBack: () => void;
  onCreateDraft: () => void;
  onOpenSettings: () => void;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const actionLabel =
    result?.action === "complete"
      ? "\u5efa\u8bae\u6807\u8bb0\u5b8c\u6210"
      : result?.action === "merge"
        ? "\u5efa\u8bae\u5408\u5e76\u4e0e\u91cd\u65b0\u89c4\u5212"
        : result?.action === "update"
          ? "\u5efa\u8bae\u66f4\u65b0\u539f\u6709\u5b89\u6392"
          : "\u65b0\u5efa\u5b89\u6392\u8349\u7a3f";

  return (
    <div className="flex h-full flex-col bg-bg">
      <ArrangementPageHeader
        title="\u0041\u0049\u6587\u672c\u8bc6\u522b"
        onBack={onBack}
        rightAction={
          <button
            type="submit"
            form="arrangement-ai-form"
            disabled={!canSubmit || !isConfigured}
            className="flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold text-primary transition hover:bg-hover-overlay active:scale-[0.96] disabled:opacity-35"
          >
            {isLoading ? "\u8bc6\u522b\u4e2d" : "\u5f00\u59cb\u8bc6\u522b"}
          </button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-2">
        {!isConfigured && (
          <section className="mb-3 rounded-[12px] border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm leading-5 text-amber-800 shadow-[var(--mine-card-shadow)]">
            <p className="font-semibold">{"\u8bf7\u5148\u5728\u8bbe\u7f6e\u4e2d\u5b8c\u6210 AI \u6a21\u578b\u914d\u7f6e"}</p>
            <p className="mt-1 text-xs leading-5 text-amber-700">
              {"\u8bf7\u586b\u5199 Base URL\u3001Model \u548c API Key\uff0c\u7136\u540e\u518d\u8fdb\u884c\u6587\u672c\u8bc6\u522b\u3002"}
            </p>
            <button
              type="button"
              className="mt-3 flex h-10 items-center rounded-full bg-amber-100 px-3 text-sm font-semibold text-amber-800 transition active:scale-[0.98]"
              onClick={onOpenSettings}
            >
              {"\u53bb\u8bbe\u7f6e"}
            </button>
          </section>
        )}

        <section className="rounded-[12px] border border-[var(--record-card-border)] bg-[var(--record-card-bg)] px-3 py-4 shadow-[var(--mine-card-shadow)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-5 text-text">{"\u8f93\u5165\u539f\u59cb\u6587\u672c"}</h2>
              <p className="mt-1 text-xs leading-5 text-text-tertiary">
                {"\u628a\u4e8b\u60c5\u539f\u6837\u8f93\u5165\u7ed9 AI\uff0c\u5b83\u4f1a\u8bc6\u522b\u5b89\u6392\u7684\u6807\u9898\u3001\u65f6\u95f4\u3001\u5730\u70b9\u3001\u7c7b\u578b\u3001\u91cd\u8981\u6027\uff0c\u5e76\u5224\u65ad\u662f\u5426\u5e94\u8be5\u5408\u5e76\u3001\u66f4\u65b0\u6216\u5b8c\u6210\u65e2\u6709\u5b89\u6392\u3002"}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
              {aiConfig.model || "\u672a\u9009\u62e9\u6a21\u578b"}
            </span>
          </div>

          <form id="arrangement-ai-form" className="mt-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-text">{"\u539f\u59cb\u6587\u672c"}</span>
              <textarea
                value={inputText}
                onChange={(event) => onInputChange(event.target.value)}
                rows={6}
                placeholder="\u4f8b\u5982\uff1a\u4e0b\u5468\u4e00\u665a\u4e0a\u8bf7\u7814\u4e00\u548c\u7814\u4e8c\u7684\u540c\u5b66\u4e00\u8d77\u5403\u996d\uff0c\u987a\u4fbf\u8c03\u7814\u4e00\u4e0b\u5019\u9009\u9910\u5385\u3002"
                className="w-full rounded-[12px] border border-border bg-bg px-3 py-3 text-sm leading-6 text-text outline-none transition placeholder:text-text-disabled focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
          </form>
        </section>

        {errorMessage && (
          <p className="mt-3 rounded-[10px] bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
            {errorMessage}
          </p>
        )}

        {result && (
          <section className="mt-3 rounded-[12px] border border-[var(--record-card-border)] bg-[var(--record-card-bg)] px-3 py-4 shadow-[var(--mine-card-shadow)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold leading-5 text-text">{"\u8bc6\u522b\u7ed3\u679c"}</h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  result.confidence === "high"
                    ? "bg-emerald-100 text-emerald-700"
                    : result.confidence === "low"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-700"
                )}
              >
                {result.confidence === "high"
                  ? "\u9ad8\u7f6e\u4fe1"
                  : result.confidence === "low"
                    ? "\u4f4e\u7f6e\u4fe1"
                    : "\u4e2d\u7b49\u7f6e\u4fe1"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
                {actionLabel}
              </span>
              {result.targetUid && (
                <span className="rounded-full bg-[var(--record-card-secondary-bg)] px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                  {"目标安排：" + (targetArrangementTitles[0] || result.targetUid)}
                </span>
              )}
              {targetArrangementTitles.length > 1 && (
                <span className="rounded-full bg-[var(--record-card-secondary-bg)] px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                  {"候选合并：" + targetArrangementTitles.join("、")}
                </span>
              )}
            </div>

            <div className="mt-3 space-y-3">
              <ArrangementDetailRow label="\u6807\u9898" value={result.title} />
              <ArrangementDetailRow label="\u5185\u5bb9" value={result.content} />
              <ArrangementDetailRow label="\u7c7b\u578b" value={getArrangementKindLabel(result.kind)} />
              <ArrangementDetailRow
                label="\u91cd\u8981\u6027"
                value={getArrangementPriorityLabel(result.priority)}
              />
              <ArrangementDetailRow
                label="\u65f6\u95f4"
                value={result.scheduledAtText || "\u672a\u8bc6\u522b\u5230\u660e\u786e\u65f6\u95f4"}
              />
              <ArrangementDetailRow
                label="\u5730\u70b9"
                value={result.location || "\u672a\u8bc6\u522b\u5230\u660e\u786e\u5730\u70b9"}
              />
              <ArrangementDetailRow
                label="\u53c2\u4e0e\u4eba"
                value={
                  result.participants.length > 0
                    ? formatArrangementTextList(result.participants)
                    : "\u672a\u8bc6\u522b\u5230\u53c2\u4e0e\u4eba"
                }
              />
              <ArrangementDetailRow
                label="\u6807\u7b7e"
                value={
                  result.tags.length > 0 ? formatArrangementTextList(result.tags) : "\u672a\u8bc6\u522b\u5230\u6807\u7b7e"
                }
              />
              <ArrangementDetailRow
                label="\u5b8c\u6210\u6807\u51c6"
                value={result.completionCriteria || "\u672a\u8bc6\u522b\u5230\u5b8c\u6210\u6807\u51c6"}
              />
              <ArrangementDetailRow
                label="\u8bc6\u522b\u8bf4\u660e"
                value={result.notes || "\u65e0\u989d\u5916\u8bf4\u660e"}
              />
              {result.optimizationSummary && (
                <ArrangementDetailRow
                  label="\u4f18\u5316\u5efa\u8bae"
                  value={result.optimizationSummary}
                />
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={!canCreateDraft}
                className="h-10 rounded-[10px] bg-primary px-4 text-sm font-semibold text-on-primary transition active:scale-[0.97] disabled:opacity-35"
                onClick={onCreateDraft}
              >
                {"\u751f\u6210\u8349\u7a3f"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
function ArrangementTextField({
  label,
  placeholder,
  value,
  onChange,
  autoCapitalize,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoCapitalize?: string;
  type?: React.HTMLInputTypeAttribute;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>
      <input
        type={type}
        value={value}
        autoCapitalize={autoCapitalize}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[12px] border border-border bg-bg px-3 text-sm text-text outline-none transition placeholder:text-text-disabled focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}



function InsightPreview() {
  const { t } = usePreferences();

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center bg-bg px-4">
        <h1 className="text-lg font-semibold text-text">{t("insight.title")}</h1>
      </header>
      <div className="flex flex-1 items-center justify-center px-8 text-center">
        <div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-text">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-semibold text-text">
            {t("insight.emptyTitle")}
          </p>
          <p className="mt-1 text-xs text-text-muted">{t("insight.emptyDesc")}</p>
        </div>
      </div>
    </div>
  );
}

function MinePreview({
  records,
  onOpenSettings,
  onOpenAbout,
}: {
  records: RecordItem[];
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}) {
  const { resolvedLocale, resolvedTheme, t } = usePreferences();
  const candidateProfile = useCandidateProfile();
  const mineImagePrefix = resolvedTheme === "dark" ? "/images/mine/theme_dark/" : "/images/mine/";
  const mineUserName = candidateProfile?.name || t("mine.user");
  const mineAvatarLabel =
    candidateProfile?.avatarLabel || t("recordDetail.me").slice(0, 1);
  const quickNoteCount = records.length;
  const wordCount = records.reduce(
    (total, record) => total + countRecordTextLength(record.text_content),
    0
  );
  const quickNoteCountText = formatNumberForLocale(quickNoteCount, resolvedLocale);
  const wordCountText = formatNumberForLocale(wordCount, resolvedLocale);
  const mineStats = [
    t("mine.stat1"),
    formatStatTemplate(t("mine.stat2"), {
      count: quickNoteCountText,
      places: "0",
    }),
    t("mine.stat3"),
    formatStatTemplate(t("mine.stat4"), {
      words: wordCountText,
    }),
  ];
  const mineDataTags = [
    t("mine.tagImportExport"),
    t("mine.tagDataSecurity"),
    t("mine.tagPrivacy"),
  ];

  return (
    <div className="h-full overflow-y-auto bg-bg pb-4">
      <section className="relative overflow-hidden pb-5 pt-10">
        <img
          src="/images/mine/image_mine_page_background.png"
          alt=""
          className="pointer-events-none absolute -right-[52px] -top-11 h-[273px] w-[375px] max-w-none object-cover"
          aria-hidden="true"
        />

        <button
          type="button"
          className="absolute right-0 top-14 z-10 flex w-[98px] items-center rounded-l-[10px] bg-[var(--mine-world-bg)] py-[7px] pl-3 pr-1.5 text-[14px] leading-4 text-text transition active:scale-[0.98]"
        >
          {t("mine.world")}
          <ChevronRightIcon className="ml-0.5 h-4 w-4 shrink-0 text-text" />
        </button>

        <div className="relative z-10 flex items-center pl-4 pr-[112px]">
          <div
            className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full border border-border-strong/80 bg-primary text-[23px] font-semibold leading-none text-on-primary shadow-[var(--mine-card-shadow)]"
            aria-label={t("mine.avatarAlt")}
          >
            {mineAvatarLabel}
          </div>
          <div className="ml-3 min-w-0">
            <div className="flex items-center">
              <p className="truncate text-xl leading-5 text-text">{mineUserName}</p>
              <ChevronRightIcon className="ml-1.5 h-4 w-4 shrink-0 text-text-disabled" />
            </div>
            <div className="mt-3 flex h-4 items-center">
              <div className="h-[3px] w-[83px] overflow-hidden rounded-full bg-[rgba(136,136,136,0.2)]">
                <div className="h-full w-[18%] rounded-full bg-primary" />
              </div>
              <p className="ml-2 text-xs leading-4 text-text-tertiary">
                {t("mine.storage")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-2.5 pt-[50px]">
        <button
          type="button"
          className="absolute left-2.5 right-2.5 top-2.5 z-0 flex min-h-[70px] items-start rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-member-bg)] px-2.5 pb-3 pt-3 text-left shadow-[var(--mine-card-shadow)] transition active:scale-[0.99]"
        >
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center">
              <p className="shrink-0 text-sm font-bold leading-4 text-text">
                {t("mine.memberTitle")}
              </p>
              <p className="ml-1.5 truncate text-xs leading-4 text-text-tertiary">
                {t("mine.memberDesc")}
              </p>
            </div>
          </div>
          <div className="ml-2 flex shrink-0 items-center text-sm leading-4 text-primary">
            {t("mine.memberAction")}
            <ChevronRightIcon className="h-4 w-4" />
          </div>
        </button>

        <div className="relative z-10 overflow-hidden rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-card-bg)] shadow-[var(--mine-card-shadow)]">
          <img
            src={mineImagePrefix + "image_mine_page_migong_background.png"}
            alt=""
            className="pointer-events-none absolute -right-px bottom-0 h-[179px] w-[179px]"
            aria-hidden="true"
          />
          <div className="relative px-3 pb-2.5 pt-2.5">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm leading-[22px] text-text-tertiary">
                {t("mine.statsTitle")}
              </p>
              <button
                type="button"
                className="ml-3 flex shrink-0 items-center text-sm leading-[22px] text-text-tertiary transition active:scale-[0.98]"
              >
                {t("mine.statsButton")}
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 space-y-0.5">
              {mineStats.map((line) => (
                <p key={line} className="text-base leading-7 text-text">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-2.5 px-2.5">
        <button
          type="button"
          className="relative w-full overflow-hidden rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-card-bg)] text-left shadow-[var(--mine-card-shadow)] transition active:scale-[0.99]"
        >
          <img
            src={mineImagePrefix + "image_mine_page_datamanager_protect_background.png"}
            alt=""
            className="pointer-events-none absolute -right-px bottom-0 h-24 w-[106px]"
            aria-hidden="true"
          />
          <div className="relative px-3 pb-2.5 pt-2.5">
            <h2 className="text-base font-bold leading-6 text-text">
              {t("mine.dataTitle")}
            </h2>
            <p className="mt-px text-sm leading-5 text-text-tertiary">
              {t("mine.dataDesc")}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {mineDataTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[8px] bg-[rgba(136,136,136,0.12)] px-2 py-1 text-xs leading-4 text-text-tertiary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </button>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <MineActionCard
            title={t("mine.settings")}
            description={t("mine.settingsDesc")}
            onClick={onOpenSettings}
          />
          <MineActionCard
            title={t("mine.about")}
            description={t("mine.aboutDesc")}
            onClick={onOpenAbout}
          />
        </div>
      </section>
    </div>
  );
}

function AboutScreen({ onBack }: { onBack: () => void }) {
  const { t } = usePreferences();
  const legalLinks = [
    {
      title: t("about.userAgreement"),
      url: "https://www.jiwo.cc/article/user-aggrement-v1.html",
    },
    {
      title: t("about.privacyTerms"),
      url: "https://www.jiwo.cc/article/privacy-aggrement-v1.html",
    },
    {
      title: t("about.privacyStatement"),
      url: "https://www.jiwo.cc/article/privacy-protect-v1.html?canReset=true",
    },
  ];
  const runLinks = [
    {
      title: t("about.wechatOfficial"),
      icon: "/images/about/icon_run_weixin_gongzhonghao.svg",
      url: "/images/about/image_wxgongzhonghao_qrcode.png",
    },
    {
      title: t("about.xiaohongshu"),
      icon: "/images/about/icon_run_xiaohongshu.svg",
      url: "https://www.xiaohongshu.com/user/profile/645464ff00000000290168b1?xhsshare=CopyLink&appuid=645464ff00000000290168b1&apptime=1716282708",
    },
    {
      title: t("about.douyin"),
      icon: "/images/about/icon_run_douyin.png",
      url: "https://www.douyin.com/user/MS4wLjABAAAACyK_g4xd0gUVN4ViU4FigeAYc2RFPO-sEp9RjXc6C4OWmDF9cJx9nzXBSEDw2J-C",
    },
    {
      title: t("about.jike"),
      icon: "/images/about/icon_run_jike.svg",
      url: "https://okjk.co/tHwXUq",
    },
    {
      title: t("about.weibo"),
      icon: "/images/about/icon_run_weibo.svg",
      url: "https://weibo.com/u/7960184078",
    },
  ];
  const footerRecords = [
    "ICP备案号：鄂ICP备2024037215号",
    "澧炲€肩數淇′笟鍔＄粡钀ヨ鍙瘉锛氶剛B2-20240478",
    "妯″瀷鍚嶇О锛欴eepSeek-R1",
    "互联网信息服务算法备案号：网信算备330110507206401230035号",
    "软著：软著登字第14519261号",
    "森奇思(武汉)科技有限公司",
  ];

  return (
    <div className="flex h-full flex-col bg-bg">
      <MobilePageHeader title={t("mine.about")} onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col px-2.5">
          <section className="flex flex-col items-center pt-[35px]">
            <img
              src="/images/about/icon_logo_jiwo.png"
              alt={t("about.appName")}
              className="h-[72px] w-[72px] rounded-[12px] object-cover"
            />
            <h1 className="mt-[5px] text-[24px] font-medium leading-[34px] text-text">
              {t("about.appName")}
            </h1>
            <p className="text-[14px] leading-[14px] text-text-muted">v0.1.0</p>
          </section>

          <section className="mt-[22px] overflow-hidden rounded-[12px] bg-surface shadow-[var(--mine-card-shadow)]">
            {legalLinks.map((item) => (
              <AboutListItem
                key={item.title}
                title={item.title}
                onClick={() => openExternalLink(item.url)}
              />
            ))}
            <AboutListItem
              title={t("about.appReview")}
              rightLabel={t("about.appReviewTip")}
              onClick={() =>
                openExternalLink(
                  "https://apps.apple.com/app/id6480506979?action=write-review"
                )
              }
            />
            <AboutListItem
              title={t("about.contactAuthor")}
              description={t("about.contactAuthorDesc")}
              external
              onClick={() => openExternalLink("https://jiwo.cc/arkmets")}
            />
          </section>

          <footer className="mt-auto flex flex-col items-center pb-3 pt-10 text-center">
            <p className="text-[14px] leading-5 text-text-muted">
              {t("about.appName")}
            </p>
            <p className="text-[14px] leading-5 text-text-muted">
              {t("about.socialChannels")}
            </p>
            <div className="mt-[11px] flex items-center justify-center gap-2.5">
              {runLinks.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-[0.96]"
                  onClick={() => openExternalLink(item.url)}
                  aria-label={item.title}
                >
                  <img src={item.icon} alt="" className="h-9 w-9" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="mt-[42px] space-y-0.5">
              {footerRecords.map((record) => (
                <p
                  key={record}
                  className="px-2 text-[10px] leading-4 text-text-disabled"
                >
                  {record}
                </p>
              ))}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function AboutListItem({
  title,
  description,
  rightLabel,
  external,
  onClick,
}: {
  title: string;
  description?: string;
  rightLabel?: string;
  external?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-[50px] w-full items-center border-b border-border-light px-3 text-left last:border-b-0 transition hover:bg-bg active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-5 text-text">{title}</p>
        {description && (
          <p className="mt-0.5 truncate text-xs leading-4 text-text-tertiary">
            {description}
          </p>
        )}
      </div>
      {rightLabel && (
        <span className="ml-2 max-w-[128px] truncate text-sm leading-5 text-text-tertiary">
          {rightLabel}
        </span>
      )}
      {external ? (
        <ExternalLinkIcon className="ml-2 h-4 w-4 shrink-0 text-text-disabled" />
      ) : (
        <ChevronRightIcon className="ml-2 h-4 w-4 shrink-0 text-text-disabled" />
      )}
    </button>
  );
}

function MineActionCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[74px] rounded-[12px] border border-[var(--mine-card-border)] bg-[var(--mine-card-bg)] px-3 pb-2.5 pt-2.5 text-left shadow-[var(--mine-card-shadow)] transition active:scale-[0.99]"
    >
      <h2 className="text-base font-bold leading-6 text-text">{title}</h2>
      <p className="mt-px text-sm leading-5 text-text-tertiary">{description}</p>
    </button>
  );
}

function SettingsScreen({
  onBack,
  onOpenAppearance,
  onOpenArrangementAi,
  arrangementAiConfig,
}: {
  onBack: () => void;
  onOpenAppearance: () => void;
  onOpenArrangementAi: () => void;
  arrangementAiConfig: ArrangementAiConfig;
}) {
  const { localeCode, resolvedLocale, t } = usePreferences();
  const [showLanguageSheet, setShowLanguageSheet] = React.useState(false);
  const aiConfigDescription = isArrangementAiConfigReady(arrangementAiConfig)
    ? arrangementAiConfig.model + " · 已配置"
    : "未配置";

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <MobilePageHeader title={t("settings.title")} onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        <div className="overflow-hidden rounded-[12px] bg-surface">
          <SettingsListItem
            title="AI 妯″瀷"
            description={aiConfigDescription}
            onClick={onOpenArrangementAi}
          />
          <SettingsListItem
            title={t("settings.appearance")}
            description={t("settings.appearanceDesc")}
            onClick={onOpenAppearance}
          />
          <SettingsListItem
            title={t("settings.language")}
            description={t("settings.current") + "：" + (
              localeCode === ""
                ? t("settings.followSystem")
                : getLocaleDisplayName(localeCode, resolvedLocale)
            )}
            onClick={() => setShowLanguageSheet(true)}
          />
        </div>
      </div>

      {showLanguageSheet && (
        <LanguageSheet onClose={() => setShowLanguageSheet(false)} />
      )}
    </div>
  );
}

function ArrangementAiSettingsScreen({
  config,
  onBack,
  onSave,
}: {
  config: ArrangementAiConfig;
  onBack: () => void;
  onSave: (config: ArrangementAiConfig) => void;
}) {
  const [apiKey, setApiKey] = React.useState(config.apiKey);
  const [baseUrl, setBaseUrl] = React.useState(config.baseUrl);
  const [model, setModel] = React.useState(config.model);
  const [saveMessage, setSaveMessage] = React.useState("");
  const canSave = apiKey.trim().length > 0 && baseUrl.trim().length > 0 && model.trim().length > 0;

  return (
    <div className="flex h-full flex-col bg-bg">
      <MobilePageHeader title="AI 模型" onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3">
        <section className="rounded-[12px] bg-surface px-3 pb-3 pt-3 shadow-[var(--mine-card-shadow)]">
          <h2 className="text-[15px] font-semibold leading-5 text-text">连接配置</h2>
          <p className="mt-1 text-xs leading-5 text-text-tertiary">
            当前版本直接从前端调用兼容 OpenAI Chat Completions 的接口，识别结果仅展示或进入草稿确认，不会自动创建正式安排。          </p>

          <div className="mt-4 space-y-3">
            <ArrangementTextField
              label="Base URL"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={setBaseUrl}
              autoCapitalize="none"
            />
            <ArrangementTextField
              label="Model"
              placeholder="gpt-4.1-mini"
              value={model}
              onChange={setModel}
              autoCapitalize="none"
            />
            <ArrangementTextField
              label="API Key"
              placeholder="sk-..."
              value={apiKey}
              onChange={(value) => {
                setApiKey(value);
                setSaveMessage("");
              }}
              autoCapitalize="none"
              type="password"
            />
          </div>
        </section>

        <section className="mt-3 rounded-[12px] bg-surface px-3 pb-3 pt-3 shadow-[var(--mine-card-shadow)]">
          <h2 className="text-[15px] font-semibold leading-5 text-text">接口要求</h2>
          <div className="mt-2 space-y-2 text-xs leading-5 text-text-tertiary">
            <p>{"需要支持 POST /chat/completions。"}</p>
            <p>{"返回内容需要包含 choices[0].message.content。"}</p>
            <p>{"模型需要稳定输出 JSON，否则识别会失败。"}</p>
          </div>
        </section>
        {saveMessage && (
          <p className="mt-3 rounded-[10px] bg-primary-soft px-3 py-2 text-xs leading-5 text-primary">
            {saveMessage}
          </p>
        )}
      </div>

      <div className="shrink-0 bg-bg px-3 pb-4 pt-2">
        <button
          type="button"
          disabled={!canSave}
          className="flex h-12 w-full items-center justify-center rounded-[12px] bg-primary text-[15px] font-semibold text-on-primary shadow-[var(--mine-card-shadow)] transition active:scale-[0.98] disabled:opacity-35"
          onClick={() => {
            const nextConfig = normalizeArrangementAiConfig({
              apiKey,
              baseUrl,
              model,
            });
            if (!hasOnlyPrintableAscii(nextConfig.apiKey)) {
               setSaveMessage("API Key 包含异常字符，请重新粘贴纯英文密钥。");
              return;
            }
            onSave(nextConfig);
            setApiKey(nextConfig.apiKey);
            setBaseUrl(nextConfig.baseUrl);
            setModel(nextConfig.model);
            setSaveMessage(
              nextConfig.apiKey === apiKey.trim()
                ? "配置已保存"
                : "配置已保存，并自动移除了空格或隐藏字符"
            );
          }}
        >
          保存配置
        </button>
      </div>
    </div>
  );
}

function AppearanceStyleScreen({ onBack }: { onBack: () => void }) {
  const {
    accentColor,
    appIcon,
    isVip,
    resolvedTheme,
    setAccentColor,
    setAppIcon,
    setThemeMode,
    t,
    themeMode,
  } = usePreferences();
  const [limitMessage, setLimitMessage] = React.useState("");
  const themeOptions: Array<{ value: ThemeMode; label: string; preview: ResolvedTheme }> = [
    { value: "system", label: t("appearance.themeSystem"), preview: resolvedTheme },
    { value: "light", label: t("appearance.themeLight"), preview: "light" },
    { value: "dark", label: t("appearance.themeDark"), preview: "dark" },
  ];
  const iconOptions: Array<{ value: AppIcon; label: string; vip?: boolean }> = [
    { value: "classic", label: t("appearance.iconClassic") },
    { value: "bright", label: t("appearance.iconBright"), vip: true },
  ];

  const trySetAccentColor = (value: AccentColor) => {
    setLimitMessage("");
    setAccentColor(value);
  };

  const trySetAppIcon = (value: AppIcon, needsVip?: boolean) => {
    if (needsVip && !isVip) {
      setLimitMessage(t("appearance.freeLimit"));
      return;
    }
    setLimitMessage("");
    setAppIcon(value);
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <MobilePageHeader title={t("appearance.title")} onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3">
        <section className="rounded-[12px] bg-surface px-3 pb-3 pt-3">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {t("appearance.theme")}
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setThemeMode(option.value)}
                className={cn(
                  "rounded-[10px] border px-2 pb-2 pt-2 text-left transition active:scale-[0.98]",
                  themeMode === option.value
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface"
                )}
              >
                <ThemePreview mode={option.preview} />
                <p className="mt-2 truncate text-center text-xs font-medium text-text">
                  {option.label}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3 rounded-[12px] bg-surface px-3 pb-3 pt-3">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {t("appearance.accent")}
          </h2>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {accentColorOptions.map((option) => {
              const active = accentColor === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => trySetAccentColor(option.key)}
                  className={cn(
                    "relative flex min-h-[74px] flex-col items-center justify-center rounded-[10px] border bg-surface transition active:scale-[0.98]",
                    active ? "border-primary" : "border-border"
                  )}
                >
                  <span
                    className="h-7 w-7 rounded-full border-[3px]"
                    style={{
                      backgroundColor: option.color,
                      borderColor: active ? option.border : "transparent",
                    }}
                  />
                  <span className="mt-2 text-xs text-text">
                    {t("accent." + option.key)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-3 rounded-[12px] bg-surface px-3 pb-3 pt-3">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {t("appearance.icon")}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {iconOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => trySetAppIcon(option.value, option.vip)}
                className={cn(
                  "relative flex min-h-[74px] items-center rounded-[10px] border bg-surface px-3 text-left transition active:scale-[0.98]",
                  appIcon === option.value ? "border-primary" : "border-border"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary">
                  <img
                    src={getJiwoLogoSrc(option.value, resolvedTheme)}
                    alt=""
                    className="w-8"
                  />
                </div>
                <span className="ml-3 text-sm font-medium text-text">{option.label}</span>
                {option.vip && !isVip && (
                  <span className="absolute right-2 top-2 rounded-full bg-vip px-1.5 py-0.5 text-[9px] leading-3 text-white">
                    {t("common.vip")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {limitMessage && (
          <p className="mt-3 rounded-[10px] bg-primary-soft px-3 py-2 text-xs leading-5 text-primary">
            {limitMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function LanguageSheet({ onClose }: { onClose: () => void }) {
  const { localeCode, setLocaleCode, t } = usePreferences();

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay-light"
        onClick={onClose}
        aria-label={t("common.done")}
      />
      <div className="relative max-h-[76%] overflow-hidden rounded-t-[22px] bg-surface shadow-[0_-10px_30px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div>
            <h2 className="text-lg font-semibold leading-6 text-text">
              {t("settings.language")}
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              {t("settings.languageSheetDesc")}
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 items-center rounded-full px-3 text-sm font-medium text-primary transition hover:bg-hover-overlay active:scale-[0.98]"
            onClick={onClose}
          >
            {t("common.done")}
          </button>
        </div>

        <div className="max-h-[560px] overflow-y-auto px-2 pb-5">
          {supportedLocales.map((option) => {
            const active = option.code === localeCode;
            return (
              <button
                key={option.code || "system"}
                type="button"
                onClick={() => {
                  setLocaleCode(option.code as LocaleCode);
                  onClose();
                }}
                className="flex h-12 w-full items-center justify-between rounded-[10px] px-3 text-left transition hover:bg-bg active:scale-[0.99]"
              >
                <span className="text-[15px] leading-5 text-text">
                  {option.code === "" ? t("settings.followSystem") : option.displayName}
                </span>
                {active && (
                  <span className="text-sm font-semibold text-primary">
                    {t("common.selected")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SettingsListItem({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[62px] w-full items-center border-b border-border-light px-3 text-left last:border-b-0 transition hover:bg-bg active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium leading-5 text-text">{title}</p>
        <p className="mt-1 truncate text-xs leading-4 text-text-tertiary">
          {description}
        </p>
      </div>
      <ChevronRightIcon className="ml-2 h-4 w-4 shrink-0 text-text-disabled" />
    </button>
  );
}

function MobilePageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = usePreferences();

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border-light bg-bg px-2">
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-hover-overlay active:scale-[0.96]"
        onClick={onBack}
        aria-label={t("common.back")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="ml-1 truncate text-[17px] font-semibold leading-5 text-text">
        {title}
      </h1>
    </header>
  );
}

function ThemePreview({ mode }: { mode: ResolvedTheme }) {
  const isDark = mode === "dark";

  return (
    <div
      className={cn(
        "h-[58px] overflow-hidden rounded-[8px] border p-1.5",
        isDark ? "border-[#333] bg-[#111]" : "border-[#e6e6e6] bg-[#f6f6f6]"
      )}
    >
      <div
        className={cn(
          "h-2.5 w-10 rounded-full",
          isDark ? "bg-[#2d2d2d]" : "bg-white"
        )}
      />
      <div className="mt-2 flex gap-1">
        <span className="h-7 flex-1 rounded-[5px] bg-primary" />
        <span
          className={cn(
            "h-7 flex-1 rounded-[5px]",
            isDark ? "bg-[#242424]" : "bg-white"
          )}
        />
      </div>
    </div>
  );
}

function getTabLabel(page: PageType, t: ReturnType<typeof usePreferences>["t"]) {
  if (page === "records") return t("tabs.records");
  if (page === "arrangements") return "安排";
  if (page === "insight") return t("tabs.insight");
  return t("tabs.mine");
}

function getJiwoLogoSrc(appIcon: AppIcon, resolvedTheme: ResolvedTheme) {
  if (appIcon === "bright" || resolvedTheme === "dark") {
    return "/images/logo-jiwo-green.svg";
  }
  return "/images/logo-jiwo.svg";
}

function formatRoundCount(count: number, label: string) {
  return /^[a-zA-Z]/.test(label) ? count + " " + label : String(count) + label;
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 4L10 8L6 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6.5 4.5H4.25A1.75 1.75 0 0 0 2.5 6.25v5.5c0 .97.78 1.75 1.75 1.75h5.5c.97 0 1.75-.78 1.75-1.75V9.5M8.5 2.5h5m0 0v5m0-5-6.25 6.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendToSelfIcon({ className }: { className?: string }) {
  const { resolvedTheme } = usePreferences();
  const src =
    resolvedTheme === "dark"
      ? "/images/icon_send_to_self_sidebar_dark.svg"
      : "/images/icon_send_to_self_sidebar.svg";

  return (
    <img src={src} alt="" className={className} aria-hidden="true" />
  );
}

function OverviewEntryTag({ label }: { label: string }) {
  return (
    <span className="ml-1.5 shrink-0 rounded-[10px] bg-[var(--overview-entry-tag-bg)] px-2 py-0.5 text-[10px] font-medium leading-[14px] text-text-tertiary">
      {label}
    </span>
  );
}




