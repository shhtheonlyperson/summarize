import type { LocalModelRoutingConfig, ModelConfig, SummarizeConfig } from "../config.js";
import type { OutputLanguage } from "../language.js";

export type LocalModelRoutingBucket = "english" | "traditionalChinese" | "bilingual" | "fallback";

export const DEFAULT_LOCAL_MODEL_ROUTING_MODELS = {
  englishModel: "openai/gemma4-31b",
  traditionalChineseModel: "openai/qwen3.5-27b",
  bilingualModel: "openai/qwen3.5-27b",
  fallbackModel: "openai/gemma4-31b",
} as const satisfies Required<Omit<LocalModelRoutingConfig, "enabled">>;

function normalizeForMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(/[^a-z0-9\u4e00-\u9fff+-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function isBilingualLanguage(language: OutputLanguage): boolean {
  if (language.kind !== "fixed") return false;
  const values = [language.tag, language.label].map(normalizeForMatch);
  return values.some((value) => {
    if (value.includes("bilingual")) return true;
    if (value.includes("\u4e2d\u82f1") || value.includes("\u82f1\u4e2d")) return true;
    const mentionsEnglish = value.includes("english") || /\ben\b/.test(value);
    const mentionsChinese =
      value.includes("chinese") ||
      value.includes("zh") ||
      value.includes("\u4e2d\u6587") ||
      value.includes("\u6f22") ||
      value.includes("\u7e41\u9ad4");
    return mentionsEnglish && mentionsChinese;
  });
}

function isTraditionalChineseLanguage(language: OutputLanguage): boolean {
  if (language.kind !== "fixed") return false;
  const values = [language.tag, language.label].map(normalizeForMatch);
  return values.some(
    (value) =>
      value === "zh-tw" ||
      value === "zh-hant" ||
      value.includes("traditional-chinese") ||
      value.includes("chinese-traditional") ||
      value.includes("\u7e41\u9ad4") ||
      value.includes("\u6b63\u9ad4"),
  );
}

function isEnglishLanguage(language: OutputLanguage): boolean {
  if (language.kind !== "fixed") return false;
  const tag = normalizeForMatch(language.tag);
  const label = normalizeForMatch(language.label);
  return tag === "en" || tag.startsWith("en-") || label === "english";
}

export function classifyLocalModelRoutingLanguage(
  language: OutputLanguage,
): LocalModelRoutingBucket {
  if (isBilingualLanguage(language)) return "bilingual";
  if (isTraditionalChineseLanguage(language)) return "traditionalChinese";
  if (isEnglishLanguage(language)) return "english";
  return "fallback";
}

function findNamedModel(config: SummarizeConfig | null, rawModel: string): ModelConfig | null {
  const requested = rawModel.trim().toLowerCase();
  if (!requested || requested === "auto") return null;
  for (const [name, model] of Object.entries(config?.models ?? {})) {
    if (name.trim().toLowerCase() === requested) return model;
  }
  return null;
}

function normalizeRoutedModelInput(config: SummarizeConfig | null, rawModel: string): string {
  const trimmed = rawModel.trim();
  if (findNamedModel(config, trimmed)) return trimmed;
  return trimmed.includes("/") ? trimmed : `openai/${trimmed}`;
}

export function resolveLanguageAwareLocalModelInput({
  config,
  outputLanguage,
}: {
  config: SummarizeConfig | null;
  outputLanguage: OutputLanguage | null | undefined;
}): { modelInput: string; bucket: LocalModelRoutingBucket } | null {
  const routing = config?.localRouting;
  if (routing?.enabled !== true) return null;

  const bucket = outputLanguage
    ? classifyLocalModelRoutingLanguage(outputLanguage)
    : ("fallback" as const);
  const configured =
    bucket === "english"
      ? routing.englishModel
      : bucket === "traditionalChinese"
        ? routing.traditionalChineseModel
        : bucket === "bilingual"
          ? routing.bilingualModel
          : routing.fallbackModel;
  const defaultModel =
    bucket === "english"
      ? DEFAULT_LOCAL_MODEL_ROUTING_MODELS.englishModel
      : bucket === "traditionalChinese"
        ? DEFAULT_LOCAL_MODEL_ROUTING_MODELS.traditionalChineseModel
        : bucket === "bilingual"
          ? DEFAULT_LOCAL_MODEL_ROUTING_MODELS.bilingualModel
          : DEFAULT_LOCAL_MODEL_ROUTING_MODELS.fallbackModel;
  const selected = configured ?? routing.fallbackModel ?? defaultModel;
  return {
    modelInput: normalizeRoutedModelInput(config, selected),
    bucket,
  };
}
