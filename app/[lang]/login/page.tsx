import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import LoginForm from './LoginForm';
import { getDictionary, getLocale } from '../dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.auth.metaSignIn, description: dict.auth.metaSignInDescription };
}

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function Page({ searchParams }: PageProps<'/[lang]/login'>) {
  const params = await searchParams;
  const next = first(params?.next);
  const notice = first(params?.error);
  const locale = await getLocale();

  if (await getUser()) {
    redirect(typeof next === 'string' && next.startsWith('/') ? next : `/${locale}/profile`);
  }

  return <LoginForm next={next} notice={notice} />;
}
