import React from "react";
import { createPortal } from "react-dom";
import { useCandidateProfile } from "@/data/candidateProfile";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/settings/preferences";

type ChatBubbleProps = {
  textContent: string;
  animationDelay?: string;
  disableAnimation?: boolean;
  variant?: "record" | "primary";
  align?: "start" | "end";
  showSelfAvatar?: boolean;
  topLabel?: string;
  onOpenDetail?: () => void;
  onOpenMemorySnapshot?: () => void;
  onRecognizeAsArrangement?: () => void;
  onEnterSelectionMode?: () => void;
  reference?: {
    label: string;
    text: string;
    onClick: () => void;
  };
  source?: {
    label: string;
    actionLabel: string;
    iconLabel: string;
    onClick: () => void;
  };
};

type ActionMenuPlacement = "above" | "below";

type ActionMenuPosition = {
  left: number;
  top: number;
  arrowLeft: number;
  placement: ActionMenuPlacement;
};

export default function ChatBubble({
  textContent,
  animationDelay,
  disableAnimation = false,
  variant = "record",
  align = "end",
  showSelfAvatar = true,
  topLabel,
  onOpenDetail,
  onRecognizeAsArrangement,
  onEnterSelectionMode,
  reference,
  source,
}: ChatBubbleProps) {
  const { t } = usePreferences();
  const candidateProfile = useCandidateProfile();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState<ActionMenuPosition>({
    left: 0,
    top: 0,
    arrowLeft: 36,
    placement: "below",
  });
  const cardRef = React.useRef<HTMLDivElement>(null);
  const longPressTimerRef = React.useRef<number | null>(null);
  const longPressTriggeredRef = React.useRef(false);
  const hasText = textContent && textContent.length > 0;
  const canOpenMenu =
    hasText || Boolean(onRecognizeAsArrangement) || Boolean(onEnterSelectionMode);

  const clearLongPressTimer = React.useCallback(() => {
    if (longPressTimerRef.current === null) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  React.useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const updateActionMenuPosition = React.useCallback(() => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const menuWidth = 132;
    const menuHeight = 112;
    const arrowSize = 12;
    const arrowMargin = 16;
    const gap = 8;
    const viewportMargin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const cardCenterY = rect.top + rect.height / 2;
    const requiredSpace = menuHeight + gap;
    const availableAbove = rect.top - viewportMargin;
    const availableBelow = viewportHeight - viewportMargin - rect.bottom;
    const prefersBelow = cardCenterY < viewportHeight / 2;
    const canShowBelow = availableBelow >= requiredSpace;
    const canShowAbove = availableAbove >= requiredSpace;
    const maxLeft = Math.max(viewportMargin, viewportWidth - menuWidth - viewportMargin);
    const left = Math.min(Math.max(rect.right - menuWidth, viewportMargin), maxLeft);
    const placement: ActionMenuPlacement = prefersBelow
      ? canShowBelow || !canShowAbove
        ? "below"
        : "above"
      : canShowAbove || !canShowBelow
        ? "above"
        : "below";
    const preferredTop =
      placement === "below" ? rect.bottom + gap : rect.top - menuHeight - gap;
    const maxTop = Math.max(viewportMargin, viewportHeight - menuHeight - viewportMargin);
    const top = Math.min(Math.max(preferredTop, viewportMargin), maxTop);
    const cardCenterX = rect.left + rect.width / 2;
    const preferredArrowLeft = cardCenterX - left - arrowSize / 2;
    const arrowLeft = Math.min(
      Math.max(preferredArrowLeft, arrowMargin),
      menuWidth - arrowMargin - arrowSize
    );

    setMenuPosition({ left, top, arrowLeft, placement });
  }, []);

  React.useEffect(() => {
    if (!menuOpen) return;

    updateActionMenuPosition();
    window.addEventListener("resize", updateActionMenuPosition);
    window.addEventListener("scroll", updateActionMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateActionMenuPosition);
      window.removeEventListener("scroll", updateActionMenuPosition, true);
    };
  }, [menuOpen, updateActionMenuPosition]);

  const openActionMenu = React.useCallback(() => {
    if (!canOpenMenu) return;
    clearLongPressTimer();
    updateActionMenuPosition();
    setMenuOpen(true);
  }, [canOpenMenu, clearLongPressTimer, updateActionMenuPosition]);

  const closeActionMenu = React.useCallback(() => {
    clearLongPressTimer();
    setMenuOpen(false);
  }, [clearLongPressTimer]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canOpenMenu || event.pointerType === "mouse") return;
    longPressTriggeredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      openActionMenu();
    }, 520);
  };

  const handlePointerEnd = () => {
    clearLongPressTimer();
  };

  const handleCardClick = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (menuOpen) {
      closeActionMenu();
      return;
    }
    onOpenDetail?.();
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canOpenMenu) return;
    event.preventDefault();
    openActionMenu();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onOpenDetail) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDetail();
    }
  };

  return (
    <div
      className={cn(
        "relative flex gap-2 px-4 py-1.5",
        align === "end" ? "justify-end" : "justify-start",
        !disableAnimation && "animate-slide-up-fade opacity-0",
        animationDelay
      )}
    >
      <div className="max-w-[82%]">
        {topLabel && (
          <p
            className={cn(
              "mb-1 px-1 text-[11px] leading-4 text-primary",
              align === "end" ? "text-right" : "text-left"
            )}
          >
            {topLabel}
          </p>
        )}
        {reference && (
          <button
            type="button"
            className={cn(
              "mb-1.5 ml-auto flex max-w-full items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-left text-[12px] leading-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition active:scale-[0.99]",
              "border-[var(--record-card-border)] bg-[var(--record-card-bg)] text-text-muted hover:bg-[var(--record-card-hover-bg)]"
            )}
            onClick={(event) => {
              event.stopPropagation();
              reference.onClick();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={reference.label}
          >
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--record-topic-icon-bg)] text-text-tertiary"
              aria-hidden="true"
            >
              <svg
                className="h-2.5 w-2.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5.2 4.4H4a2 2 0 0 0-2 2V12a2 2 0 0 0 2 2h5.6a2 2 0 0 0 2-2v-1.2" />
                <path d="M7.2 2h4.8v4.8" />
                <path d="M6.7 7.3 12 2" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 truncate">{reference.text}</span>
            <svg
              className="h-3 w-3 shrink-0 text-text-tertiary"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
          </button>
        )}
        <div
          ref={cardRef}
          role={onOpenDetail ? "button" : undefined}
          tabIndex={onOpenDetail ? 0 : undefined}
          onClick={handleCardClick}
          onContextMenu={handleContextMenu}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
          onKeyDown={handleKeyDown}
          className={cn(
            "rounded-[14px] px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
            align === "end" ? "rounded-tr-[4px]" : "rounded-tl-[4px]",
            variant === "primary"
              ? "bg-primary text-on-primary"
              : "border border-[var(--record-card-border)] bg-[var(--record-card-bg)] text-text transition-[background-color,box-shadow] duration-[var(--duration)] hover:bg-[var(--record-card-hover-bg)]",
            onOpenDetail &&
              "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          )}
        >
          {hasText && (
            <p
              className={cn(
                "whitespace-pre-wrap break-words text-[14px] leading-[1.55] [overflow-wrap:anywhere]",
                variant === "primary" ? "text-on-primary" : "text-text"
              )}
            >
              {textContent}
            </p>
          )}

          {source && (
            <button
              type="button"
              className="mt-2.5 inline-flex min-h-6 max-w-full items-center rounded-[8px] border border-[var(--record-topic-border)] px-1.5 py-0.5 text-left text-[11px] leading-4 text-text-tertiary transition hover:text-text-muted active:scale-[0.99]"
              onClick={(event) => {
                event.stopPropagation();
                source.onClick();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label={source.actionLabel}
            >
              <span
                className="mr-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[var(--record-topic-icon-bg)] text-[6px] font-semibold leading-none text-text-tertiary"
                aria-hidden="true"
              >
                {source.iconLabel}
              </span>
              <span className="min-w-0 truncate">{source.label}</span>
              <svg
                className="ml-0.5 h-3 w-2 shrink-0"
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
            </button>
          )}
        </div>
      </div>
      {showSelfAvatar && (
        <SelfMessageAvatar
          label={candidateProfile?.avatarLabel || t("recordDetail.me").slice(0, 1)}
        />
      )}
      {menuOpen &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[9998] cursor-default bg-transparent"
              onClick={closeActionMenu}
              aria-label={t("recordAction.close")}
            />
            <div
              className="fixed z-[9999] w-[132px]"
              style={{
                left: `${menuPosition.left}px`,
                top: `${menuPosition.top}px`,
              }}
            >
              <span
                className={cn(
                  "absolute z-0 h-3 w-3 rotate-45 border border-[rgba(15,23,42,0.14)] bg-[var(--dialog-bg)] shadow-[0_1px_4px_rgba(15,23,42,0.18)] dark:border-white/15",
                  menuPosition.placement === "below" ? "-top-1.5" : "-bottom-1.5"
                )}
                style={{ left: `${menuPosition.arrowLeft}px` }}
                aria-hidden="true"
              />
              <div className="relative z-10 overflow-hidden rounded-[14px] border border-border-light bg-[var(--dialog-bg)] text-text shadow-[0_12px_36px_rgba(0,0,0,0.24)]">
                <div className="flex flex-col px-1.5 py-1.5">
                  <ActionMenuButton
                    label={t("recordAction.copy")}
                    onClick={async () => {
                      closeActionMenu();
                      try {
                        await navigator.clipboard?.writeText(textContent);
                      } catch {
                        // Clipboard availability differs across browsers in local demos.
                      }
                    }}
                  />
                  <ActionMenuButton
                    label="创建安排"
                    disabled={!onRecognizeAsArrangement}
                    onClick={() => {
                      closeActionMenu();
                      onRecognizeAsArrangement?.();
                    }}
                  />
                  <ActionMenuButton
                    label="多选"
                    disabled={!onEnterSelectionMode}
                    onClick={() => {
                      closeActionMenu();
                      onEnterSelectionMode?.();
                    }}
                  />
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

function SelfMessageAvatar({ label }: { label: string }) {
  return (
    <div
      className="mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold leading-none text-on-primary"
      aria-hidden="true"
    >
      {label}
    </div>
  );
}

function ActionMenuButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-[10px] px-3 py-2 text-left text-[12px] leading-5 transition",
        disabled
          ? "cursor-not-allowed text-text-tertiary opacity-40"
          : "text-text hover:bg-hover-overlay active:scale-[0.98]"
      )}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) return;
        onClick();
      }}
    >
      {label}
    </button>
  );
}
