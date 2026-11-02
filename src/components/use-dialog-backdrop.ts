"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";

function isBackdrop(event: MouseEvent<HTMLDialogElement> | PointerEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom;
}

// 原生遮罩事件以 dialog 为目标；同时检查坐标，避免点击弹窗空白处误关闭。
// 按下和松开都必须在遮罩上，拖选正文后移出弹窗也不会丢失当前内容。
export function useDialogBackdrop(onDismiss: () => void) {
  const startedOutside = useRef(false);
  return {
    onPointerDown(event: PointerEvent<HTMLDialogElement>) {
      startedOutside.current = event.isPrimary && event.button === 0 && isBackdrop(event);
    },
    onPointerCancel() { startedOutside.current = false; },
    onClick(event: MouseEvent<HTMLDialogElement>) {
      const dismiss = startedOutside.current && isBackdrop(event);
      startedOutside.current = false;
      if (!dismiss) return;
      // 嵌套弹窗只关闭最上层，不让事件传到父弹窗。
      event.stopPropagation();
      onDismiss();
    },
  };
}
