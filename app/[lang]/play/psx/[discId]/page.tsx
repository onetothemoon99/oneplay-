import type { Metadata } from 'next';
import DiscPlayClient from './DiscPlayClient';
import { getDictionary } from '../../../dictionaries';
import { getUserDto } from '@/lib/auth';

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.disc.metaTitle, description: dict.disc.metaDescription };
}

export default async function Page() {
  const user = await getUserDto();
  return <main><DiscPlayClient userId={user?.id ?? null} /></main>;
}
