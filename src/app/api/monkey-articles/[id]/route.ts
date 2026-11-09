import { readMonkeyArticle, deleteMonkeyArticle } from '../../../../lib/monkey-articles-api.ts';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) { return readMonkeyArticle((await params).id); }
export async function DELETE(request: Request, { params }: Context) { return deleteMonkeyArticle(request, (await params).id); }
