import type { Metadata } from 'next';
import PsxLibraryClient from './PsxLibraryClient';
import { getDictionary } from '../../dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.psx.metaTitle, description: dict.psx.metaDescription };
}

export default function Page() {
  return <main><PsxLibraryClient /></main>;
}
