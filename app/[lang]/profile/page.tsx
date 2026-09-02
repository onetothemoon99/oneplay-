import type { Metadata } from 'next';
import ProfileClient from './ProfileClient';
import { getDictionary } from '../dictionaries';
import { getUserDto } from '@/lib/auth';

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.profile.metaTitle, description: dict.profile.metaDescription };
}

export default async function Page() {
  const user = await getUserDto();
  return <ProfileClient isVip={user?.isVip ?? false} userId={user?.id ?? null} />;
}
