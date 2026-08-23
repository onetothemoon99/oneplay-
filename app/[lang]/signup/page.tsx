import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import SignupForm from './SignupForm';
import { getDictionary, getLocale } from '../dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.auth.metaSignUp, description: dict.auth.metaSignUpDescription };
}

export default async function Page() {
  const locale = await getLocale();
  if (await getUser()) redirect(`/${locale}/profile`);

  return <SignupForm />;
}
