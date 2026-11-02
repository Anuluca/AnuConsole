"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type MouseEvent, type KeyboardEvent } from 'react';
import { createNoteEntrance } from '@/lib/note-renderer/noteEntrance';
import { createImageCincoHover } from '@/lib/note-renderer/imageCincoHover';
import { renderNoteMarkdown } from '@/lib/note-renderer/renderNoteMarkdown';
import { handleNoteTooltipEnter, handleNoteTooltipLeave, handleNoteTooltipAnimationEnd } from '@/lib/note-renderer/noteTooltip';
import { NOTE_CATEGORIES, type NoteCategory } from '@/lib/note-categories';
import { ManagementModal } from './infrastructure/ui';
import { ManagementButton } from './infrastructure/management-button';
import '@/lib/note-renderer/noteReader.css';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

export function NotePreview({ title, category, date, body, entrance = false }: { title: string; category: NoteCategory; date: string; body: string; entrance?: boolean }) {
  const reader = useRef<HTMLElement>(null);
  const hover = useRef<ReturnType<typeof createImageCincoHover> | null>(null);
  useEffect(() => {
    const instance = createImageCincoHover({ glowStrength: 0.5 }); hover.current = instance; instance.mount();
    return () => { instance.destroy(); hover.current = null; };
  }, []);
  useEffect(() => { hover.current?.stop(); }, [body]);
  function hoverImage(event: PointerEvent<HTMLDivElement>, entering: boolean) {
    const wrapper = (event.target as HTMLElement).closest<HTMLElement>('.note-image-hover');
    if (!wrapper || wrapper.contains(event.relatedTarget as Node | null)) return;
    if (entering) hover.current?.start(event.nativeEvent, wrapper); else hover.current?.leave();
  }
  const html = useMemo(() => renderNoteMarkdown(body), [body]);
  useEffect(() => {
    if (!entrance) return;
    let animation: ReturnType<typeof createNoteEntrance> | undefined;
    const frame = requestAnimationFrame(() => { if (reader.current) animation = createNoteEntrance(reader.current); });
    return () => { cancelAnimationFrame(frame); animation?.destroy(); };
  }, [entrance, html, title, category, date]);
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  function follow(event: MouseEvent<HTMLDivElement>) {
    if (window.getSelection()?.isCollapsed === false) { event.preventDefault(); return; }
    const target = event.target as HTMLElement;
    if (target instanceof HTMLImageElement) {
      event.preventDefault(); hover.current?.stop(); setImage({ src: target.src, alt: target.alt }); return;
    }
    const link = target.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    let id: string;
    try { id = decodeURIComponent(link.hash.slice(1)); } catch { return; }
    const anchor = event.currentTarget.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
    const scroll = event.currentTarget.closest<HTMLElement>('.notes-preview, .infra-modal-content');
    if (!anchor || !scroll) return;
    event.preventDefault(); scroll.scrollTop += anchor.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
  }
  function imageKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!['Enter', ' '].includes(event.key) || !(event.target instanceof HTMLImageElement)) return;
    event.preventDefault(); hover.current?.stop(); setImage({ src: event.target.src, alt: event.target.alt });
  }
  return <>
    <article ref={reader} className="note-reader no-rem" data-note-enter={entrance ? 'pending' : undefined}>
      <header className="note-reader__header"><h1>{title || '笔记标题'}</h1><div className="note-reader__meta"><span className="note-reader__category">[<span className="note-reader__category-text">{NOTE_CATEGORIES[category].label.en}</span>]</span><time dateTime={date}>{date.replace(/-/g, '/')}</time></div></header>
      <div className="note-markdown" onClick={follow} onKeyDown={imageKey} onPointerOver={event => { hoverImage(event, true); handleNoteTooltipEnter(event.nativeEvent); }} onPointerOut={event => { hoverImage(event, false); handleNoteTooltipLeave(event.nativeEvent); }} onFocus={event => handleNoteTooltipEnter(event.nativeEvent)} onBlur={event => handleNoteTooltipLeave(event.nativeEvent)} onAnimationEnd={event => handleNoteTooltipAnimationEnd(event.nativeEvent)} onPointerCancel={() => hover.current?.stop()} dangerouslySetInnerHTML={{ __html: html }} />
    </article>
    {image && <ManagementModal title={image.alt || '图片预览'} className="notes-image-modal" onClose={() => setImage(null)} footer={<ManagementButton icon="close" data-close-modal>关闭</ManagementButton>}><img src={image.src} alt={image.alt} /></ManagementModal>}
  </>;
}
