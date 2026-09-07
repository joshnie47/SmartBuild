import React from 'react';
import {
  AlertTriangle,
  Sparkles,
  RefreshCw,
  HelpCircle,
  X,
  Info,
} from 'lucide-react';
import type { AiClassification } from '../types';

export interface ImageAnalysisData {
  authenticity?: 'LIKELY_REAL' | 'LIKELY_AI' | 'UNCERTAIN' | 'AI_GENERATED';
  aiClassification?: AiClassification;
  confidence?: number;
  aiConfidence?: number;
  authenticityScore?: number;
  scorePercentage?: number;
  reason?: string;
  analysisReason?: string;
  detectedFeatures?: string[];
  analyzedAt?: string;
}

export interface AiImageWarningModalProps {
  isOpen: boolean;
  imageUrl: string;
  originalFilename?: string;
  analysis: ImageAnalysisData | null;
  onReplace: () => void;
  onKeep: (action: 'KEEP_AI' | 'KEEP_UNVERIFIED') => void;
  onClose?: () => void;
}

export function AiImageWarningModal({
  isOpen,
  imageUrl,
  originalFilename,
  analysis,
  onReplace,
  onKeep,
  onClose,
}: AiImageWarningModalProps) {
  if (!isOpen || !analysis) return null;

  const classification =
    analysis.aiClassification ||
    (analysis.authenticity === 'LIKELY_AI' || analysis.authenticity === 'AI_GENERATED'
      ? 'LIKELY_AI_GENERATED'
      : analysis.authenticity === 'UNCERTAIN'
      ? 'UNCERTAIN'
      : 'LIKELY_REAL');

  const isAiGenerated = classification === 'LIKELY_AI_GENERATED';
  const isUncertain = classification === 'UNCERTAIN';

  const rawConfidence =
    typeof analysis.aiConfidence === 'number'
      ? analysis.aiConfidence
      : typeof analysis.confidence === 'number'
      ? analysis.confidence
      : 0.85;

  const confidencePct = Math.round(rawConfidence * 100) || analysis.scorePercentage || 85;
  const reason =
    analysis.analysisReason ||
    analysis.reason ||
    (isAiGenerated
      ? 'Detected synthetic diffusion patterns and architectural rendering characteristics.'
      : 'Visual markers were inconclusive to verify physical camera sensor signatures.');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/65 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header banner */}
        <div
          className={`px-6 py-4 text-white ${
            isAiGenerated
              ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-navy-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-sm">
                {isAiGenerated ? (
                  <AlertTriangle className="h-5 w-5 text-white" />
                ) : (
                  <HelpCircle className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  {isAiGenerated
                    ? 'AI-Generated Image Detected'
                    : 'Authenticity Could Not Be Determined'}
                </h3>
                <p className="text-xs text-white/80">SmartBuild AI Portfolio Verification</p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-white/80 hover:bg-white/20 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Image preview with classification badge */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-900 shadow-inner">
            <img
              src={imageUrl}
              alt="Detected Preview"
              className="h-full w-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md bg-amber-500/90">
              {isAiGenerated ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                  <span>Likely AI-Generated ({confidencePct}% Match)</span>
                </>
              ) : (
                <>
                  <HelpCircle className="h-3.5 w-3.5 text-blue-200" />
                  <span>Uncertain Authenticity ({confidencePct}% Inconclusive)</span>
                </>
              )}
            </div>

            {originalFilename && (
              <div className="absolute top-2.5 right-2.5 rounded bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] text-gray-200 max-w-[150px] truncate">
                {originalFilename}
              </div>
            )}

          </div>

          {/* Explanatory Policy Notice */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 leading-relaxed">
            <p className="font-semibold text-navy-800">
              {isAiGenerated ? 'What would you like to do?' : 'Choose how to proceed:'}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              {isAiGenerated ? (
                <>
                  SmartBuild values transparency for project clients. You can replace this image with an authentic on-site photograph for higher recommendation matching, or keep it explicitly labeled as an <strong>⚠ AI Generated</strong> concept rendering.
                </>
              ) : (
                <>
                  Our AI verification could not definitively confirm optical sensor signatures. You can keep this image as <strong>Unverified</strong>, or replace it with a clearer on-site photo.
                </>
              )}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-400">
              <Info className="h-3 w-3 shrink-0" />
              <span>AI analysis evaluates visual indicators with high precision; it is never 100% infallible.</span>
            </div>
          </div>

          {/* Action buttons matching exact workflow choices (Requirement 4) */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            {/* Choice 1: Replace Image */}
            <button
              type="button"
              onClick={onReplace}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-navy-600 hover:bg-navy-700 text-white font-semibold py-2.5 px-4 text-xs shadow-soft transition-transform active:scale-95"
            >
              <RefreshCw className="h-4 w-4 text-amber-300" />
              <span>{isAiGenerated ? 'Replace with Real Photo' : 'Replace with Clearer Photo'}</span>
            </button>

            {/* Choice 2: Keep Image & Mark as AI / Keep as Unverified */}
            <button
              type="button"
              onClick={() => onKeep(isAiGenerated ? 'KEEP_AI' : 'KEEP_UNVERIFIED')}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2.5 px-4 text-xs transition-colors shadow-xs"
            >
              {isAiGenerated ? (
                <>
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span>Keep & Mark as AI Generated</span>
                </>
              ) : (
                <>
                  <HelpCircle className="h-4 w-4 text-gray-600" />
                  <span>Keep as Unverified</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
