import { MonkeyArticlesManager } from '@/components/monkey-articles-manager';
import { requireUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
export const metadata = { title: '猴子打字' };
export default async function MonkeyPage({ params }: { params: Promise<{ project: string }> }) {
  const user = await requireUser();
  if ((await params).project !== 'anutrium') notFound();
  return <MonkeyArticlesManager canEdit={user.role === 'admin'} />;
}
