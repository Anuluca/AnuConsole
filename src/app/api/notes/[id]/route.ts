import { requireUser } from '../../../../lib/auth.ts';
import { deleteNote, noteResponse, notesUpstream, publishNote, validNoteId } from '../../../../lib/notes-api.ts';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  await requireUser();
  const { id } = await params;
  return validNoteId(id) ? notesUpstream(`/${id}`) : noteResponse({ error: '未找到笔记' }, 404);
}
export async function PUT(request: Request, { params }: Context) {
  return publishNote(request, (await params).id);
}

export async function PATCH(request: Request, { params }: Context) {
  return publishNote(request, (await params).id, 'PATCH');
}
export async function DELETE(request: Request, { params }: Context) {
  return deleteNote(request, (await params).id);
}
