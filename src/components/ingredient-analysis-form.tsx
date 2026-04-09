"use client";

import { useEffect, useRef, useState } from "react";

import type { IngredientAnalysisResponse, OCRExtractionResponse } from "@/features/ingredient-analysis/schemas";
import {
  APIClientError,
  extractIngredientsFromImage,
  requestFullIngredientAnalysis,
} from "@/lib/api-client";

const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const maxImageSizeBytes = 25 * 1024 * 1024;
const maxUploadSizeBytes = 900 * 1024;
const maxUploadDimension = 1600;

type SubmissionState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; data: IngredientAnalysisResponse }
  | { type: "error"; message: string };

type OCRState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; data: OCRExtractionResponse }
  | { type: "error"; message: string };

type FlowStep = "input" | "confirm" | "result";

export function IngredientAnalysisForm() {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [submissionState, setSubmissionState] = useState<SubmissionState>({ type: "idle" });
  const [ocrState, setOCRState] = useState<OCRState>({ type: "idle" });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [confirmedText, setConfirmedText] = useState("");
  const [flowStep, setFlowStep] = useState<FlowStep>("input");

  useEffect(() => {
    if (!selectedImage) {
      setImagePreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(selectedImage);
    setImagePreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedImage]);

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      resetFormState();
      return;
    }

    const validationError = validateImageFile(file);

    if (validationError) {
      setSelectedImage(null);
      setClientError(validationError);
      setOCRState({ type: "idle" });
      setSubmissionState({ type: "idle" });
      setConfirmedText("");
      setFlowStep("input");
      event.target.value = "";
      return;
    }

    try {
      const preparedFile = await prepareImageForOCR(file);
      setSelectedImage(preparedFile);
    } catch {
      setSelectedImage(null);
      setClientError("Не удалось подготовить изображение. Попробуйте выбрать другое фото.");
      setOCRState({ type: "idle" });
      setSubmissionState({ type: "idle" });
      setConfirmedText("");
      setFlowStep("input");
      event.target.value = "";
      return;
    }

    setClientError(null);
    setOCRState({ type: "idle" });
    setSubmissionState({ type: "idle" });
    setConfirmedText("");
    setFlowStep("input");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionState.type === "loading" || ocrState.type === "loading") {
      return;
    }

    if (!selectedImage) {
      setClientError("Сначала загрузите фото состава, чтобы начать распознавание.");
      return;
    }

    setClientError(null);

    if (ocrState.type !== "success") {
      await handleOCRExtraction();
      return;
    }

    const finalText = confirmedText.trim();

    if (finalText.length === 0) {
      setSubmissionState({
        type: "error",
        message: "Подтвердите или отредактируйте распознанный текст перед анализом.",
      });
      setFlowStep("confirm");
      return;
    }

    setSubmissionState({ type: "loading" });
    setFlowStep("confirm");

    try {
      const analysis = await requestFullIngredientAnalysis({
        ingredientsText: finalText,
      });

      setSubmissionState({ type: "success", data: analysis });
      setFlowStep("result");
    } catch (error) {
      setSubmissionState({
        type: "error",
        message:
          error instanceof APIClientError
            ? toUserFacingMessage(error)
            : "Не удалось завершить анализ: сервер не вернул корректный ответ.",
      });
      setFlowStep("confirm");
    }
  }

  async function handleOCRExtraction() {
    if (submissionState.type === "loading" || ocrState.type === "loading") {
      return;
    }

    if (!selectedImage) {
      setOCRState({
        type: "error",
        message: "Сначала выберите изображение для распознавания.",
      });
      return;
    }

    setOCRState({ type: "loading" });
    setSubmissionState({ type: "idle" });

    try {
      const extraction = await extractIngredientsFromImage(selectedImage);
      setConfirmedText(extraction.cleanedText);
      setOCRState({ type: "success", data: extraction });
      setFlowStep("confirm");
    } catch (error) {
      setOCRState({
        type: "error",
        message:
          error instanceof APIClientError
            ? toUserFacingMessage(error)
            : "Не удалось распознать текст на изображении: сервер не вернул корректный ответ.",
      });
      setFlowStep("input");
    }
  }

  function resetOCRConfirmation() {
    setOCRState({ type: "idle" });
    setConfirmedText("");
    setSubmissionState({ type: "idle" });
    setFlowStep("input");
  }

  function resetFormState() {
    setSelectedImage(null);
    setClientError(null);
    setOCRState({ type: "idle" });
    setSubmissionState({ type: "idle" });
    setConfirmedText("");
    setFlowStep("input");
  }

  function handleBackToUpload() {
    resetFormState();
  }

  const showConfirmation = flowStep === "confirm" && selectedImage !== null && ocrState.type === "success";
  const confirmationIngredients = splitIngredientsForPreview(confirmedText);
  const lowOCRConfidence = ocrState.type === "success" && ocrState.data.confidence < 0.7;
  const isBusy = submissionState.type === "loading" || ocrState.type === "loading";
  const isResultScreen = flowStep === "result";

  const submitButtonLabel =
    ocrState.type === "loading"
      ? "Распознаем..."
      : submissionState.type === "loading"
        ? "Анализируем..."
        : showConfirmation
          ? "Анализировать"
          : "Распознать состав";

  if (isResultScreen) {
    const resultContent =
      submissionState.type === "success" ? (
        <AnalysisResult data={submissionState.data} />
      ) : submissionState.type === "error" ? (
        <ResultErrorState message={submissionState.message} />
      ) : null;

    return (
      <section className="result-screen">
        <button
          className="back-button"
          type="button"
          onClick={handleBackToUpload}
        >
          ← Назад
        </button>

        <aside className="card summary-card result-screen-card">
          <h2 className="section-title">Результат анализа</h2>
          {resultContent}
        </aside>
      </section>
    );
  }

  return (
    <section className="analysis-screen">
      <form
        className="card form-card"
        onSubmit={handleSubmit}
      >
        <h2 className="section-title">Проверка состава</h2>
        <p className="section-copy">
          Загрузите фото этикетки с ингредиентами. После распознавания вы сможете проверить и отредактировать текст
          перед анализом.
        </p>

        <div className="stack">
          <div className="field">
            <label htmlFor="image" />
            <input
              id="image"
              ref={imageInputRef}
              className="file-input"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
            />
            <input
              id="camera-image"
              ref={cameraInputRef}
              className="file-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
            />
            <div className="file-picker-row">
              <button
                className="file-picker"
                type="button"
                onClick={() => cameraInputRef.current?.click()}
              >
                <span className="file-picker-text">Сделать фото</span>
              </button>
              <button
                className="file-picker"
                type="button"
                onClick={() => imageInputRef.current?.click()}
              >
                <span className="file-picker-text">Выбрать из галереи</span>
              </button>
            </div>
            <p className="form-hint">На телефоне кнопка "Сделать фото" открывает камеру для нового снимка.</p>
            {selectedImage ? <p className="form-hint">Выбранный файл: {selectedImage.name}</p> : null}
            {imagePreviewUrl ? (
              <div className="image-preview">
                <img
                  src={imagePreviewUrl}
                  alt="Предпросмотр выбранной этикетки"
                />
              </div>
            ) : null}
          </div>

          {showConfirmation ? (
            <div className="confirmation-panel">
              <div className="confirmation-header">
                <div>
                  <h3 className="section-title">Подтвердите распознанный состав</h3>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={resetOCRConfirmation}
                >
                  Распознать заново
                </button>
              </div>

              {lowOCRConfidence ? (
                <div className="inline-warning">
                  OCR распознал текст с низкой уверенностью. Пожалуйста, внимательно проверьте состав перед анализом.
                </div>
              ) : null}

              {ocrState.type === "success" && ocrState.data.warnings.length > 0 ? (
                <div className="result-block result-note">
                  <h3>Замечания OCR</h3>
                  <ul>
                    {ocrState.data.warnings.map((warning) => (
                      <li key={`ocr-warning-${warning}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="confirmedText" />
                <textarea
                  id="confirmedText"
                  value={confirmedText}
                  onChange={(event) => setConfirmedText(event.target.value)}
                />
              </div>

              <div className="result-block">
                <h3>Ингредиенты для быстрого просмотра</h3>
                {confirmationIngredients.length > 0 ? (
                  <div className="pill-row">
                    {confirmationIngredients.map((ingredient) => (
                      <span
                        key={`confirmed-${ingredient}`}
                        className="pill"
                      >
                        {ingredient}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-inline">
                    Пока не удалось собрать список ингредиентов. Проверьте текст выше и при необходимости исправьте его.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="">


            </div>
          )}

          <div className="actions">
            <button
              className="submit-button"
              type="submit"
              disabled={isBusy}
            >
              {submitButtonLabel}
            </button>

            {isBusy ? (
              <div
                className="loading-flower"
                aria-live="polite"
                aria-label={ocrState.type === "loading" ? "Идет распознавание изображения" : "Идет анализ состава"}
              >
                <div className="loading-flower-bloom" aria-hidden="true">
                  <span className="petal petal-1" />
                  <span className="petal petal-2" />
                  <span className="petal petal-3" />
                  <span className="petal petal-4" />
                  <span className="petal petal-5" />
                  <span className="petal petal-6" />
                  <span className="flower-core" />
                </div>
                <span className="loading-flower-text">
                  {ocrState.type === "loading" ? "Распознаем фото..." : "Анализируем состав..."}
                </span>
              </div>
            ) : null}
          </div>

          {clientError ? <p className="error-text">{clientError}</p> : null}
          {ocrState.type === "error" ? <p className="error-text">{ocrState.message}</p> : null}
          {submissionState.type === "error" ? (
            <p className="error-text">{submissionState.message}</p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function splitIngredientsForPreview(value: string): string[] {
  return value
    .split(/[,;\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateImageFile(file: File): string | null {
  if (file.size === 0) {
    return "Выбранный файл пустой. Пожалуйста, загрузите корректное изображение.";
  }

  if (!acceptedImageTypes.includes(file.type as (typeof acceptedImageTypes)[number])) {
    return "Неподдерживаемый формат файла. Пожалуйста, выберите JPG, JPEG, PNG или WEBP.";
  }

  if (file.size > maxImageSizeBytes) {
    return "Файл слишком большой. Максимальный размер - 25 МБ.";
  }

  return null;
}

async function prepareImageForOCR(file: File): Promise<File> {
  if (file.size <= maxUploadSizeBytes) {
    return file;
  }

  const imageBitmap = await readFileAsImage(file);
  const { width, height } = fitImageIntoBounds(imageBitmap.width, imageBitmap.height, maxUploadDimension);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  context.drawImage(imageBitmap, 0, 0, width, height);

  let quality = 0.9;
  let output = await canvasToFile(canvas, file.name, quality);

  while (output.size > maxUploadSizeBytes && quality > 0.45) {
    quality -= 0.1;
    output = await canvasToFile(canvas, file.name, quality);
  }

  return output;
}

async function readFileAsImage(file: File): Promise<HTMLImageElement> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to decode image."));
      image.src = imageUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function fitImageIntoBounds(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function canvasToFile(canvas: HTMLCanvasElement, originalName: string, quality: number): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  if (!blob) {
    throw new Error("Failed to encode image.");
  }

  const normalizedName = originalName.replace(/\.[^.]+$/, "") || "captured-image";

  return new File([blob], `${normalizedName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function toUserFacingMessage(error: APIClientError): string {
  switch (error.code) {
    case "empty_file":
    case "unsupported_image_type":
    case "image_too_large":
    case "ocr_empty":
    case "ocr_confidence_too_low":
    case "ocr_timeout":
    case "analysis_timeout":
    case "empty_ingredients":
      return error.message;
    case "analysis_invalid_json":
      return "Ответ анализа оказался неполным, поэтому результат может быть ограниченным. Попробуйте еще раз.";
    default:
      return error.message;
  }
}

function ResultErrorState({ message }: { message: string }) {
  return (
    <div className="result-empty result-error-state">
      <p className="eyebrow">Результат анализа</p>
      <h3>Не удалось завершить анализ</h3>
      <p>{message}</p>
    </div>
  );
}

type AnalysisResultProps = {
  data: IngredientAnalysisResponse;
};

function AnalysisResult({ data }: AnalysisResultProps) {
  return (
    <>
      <div className="result-overview">
        <div className="result-overview-row">
          <p className="result-overview-label">Статус продукта</p>
          <p className="result-overview-value">{data.analysis.productStatus}</p>
        </div>
        <div className="result-overview-row">
          <p className="result-overview-label">Кому может подойти</p>
          <p className="result-overview-value">{data.analysis.suitableFor}</p>
        </div>
        <div className="result-overview-row">
          <p className="result-overview-label">Краткий вывод</p>
          <p className="result-overview-value">{data.analysis.summary}</p>
        </div>
      </div>

      <div className="result-grid">
        <ResultSection
          title="Полезные ингредиенты"
          tone="beneficial"
          items={data.analysis.beneficial}
          emptyMessage="Явно полезные ингредиенты не были выделены."
        />
        <ResultSection
          title="Ингредиенты, требующие внимания"
          tone="caution"
          items={data.analysis.caution}
          emptyMessage="Ингредиенты с пометкой о внимании не были выделены."
        />
        <ResultSection
          title="Нейтральные ингредиенты"
          tone="neutral"
          items={data.analysis.neutral}
          emptyMessage="Нейтральные ингредиенты не были выделены отдельно."
        />
        <ResultSection
          title="Неопределенные ингредиенты"
          items={data.analysis.unknown}
          emptyMessage="В группе неопределенных ингредиентов ничего не осталось."
        />
      </div>

      <div className="result-block">
        <h3>Распознанные ингредиенты</h3>
        {data.normalizedIngredients.length > 0 ? (
          <div className="pill-row">
            {data.normalizedIngredients.map((ingredient) => (
              <span
                key={`${ingredient.raw}-${ingredient.normalized}`}
                className="pill"
              >
                {ingredient.normalized}
              </span>
            ))}
          </div>
        ) : (
          <p className="empty-inline">Список нормализованных ингредиентов оказался пустым.</p>
        )}
      </div>

      <div className="result-block">
        <h3>Дисклеймер</h3>
        <ul>
          <li>
            Данный анализ носит исключительно информационный характер и не является медицинской рекомендацией. Для
            личной оценки риска проконсультируйтесь с врачом.
          </li>
        </ul>
      </div>
    </>
  );
}

type ResultSectionProps = {
  title: string;
  tone?: "beneficial" | "caution" | "neutral";
  items: IngredientAnalysisResponse["analysis"]["beneficial"];
  emptyMessage: string;
};

function ResultSection({ title, tone, items, emptyMessage }: ResultSectionProps) {
  const toneClassName = tone ? `result-section-card--${tone}` : "";

  return (
    <section className={`result-section-card ${toneClassName}`.trim()}>
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={`${title}-${item.name}-${item.reason}`}>
              <strong>{item.name}</strong>
              <span>{item.reason}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-inline">{emptyMessage}</p>
      )}
    </section>
  );
}
