import type { Metadata } from 'next';
import PsxLibraryClient from './PsxLibraryClient';
import { getDictionary } from '../../dictionaries';
import { getUserDto } from '@/lib/auth';

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.psx.metaTitle, description: dict.psx.metaDescription };
}

export default async function Page() {
  const user = await getUserDto();
  return <main><PsxLibraryClient userId={user?.id ?? null} /></main>;
}
