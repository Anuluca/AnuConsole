// 原生 dialog 会在打开时选中控件、关闭时恢复焦点；统一取消这两种自动行为。
function clearDialogFocus(dialog: HTMLDialogElement) {
  const active = dialog.ownerDocument.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

export function openDialog(dialog: HTMLDialogElement) {
  dialog.showModal();
  clearDialogFocus(dialog);
}

export function closeDialog(dialog: HTMLDialogElement) {
  dialog.close();
  clearDialogFocus(dialog);
}
