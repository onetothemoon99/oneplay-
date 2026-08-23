import type { Metadata } from 'next';
import NotFoundClient from './NotFoundClient';
import { getDictionarySafe } from './dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionarySafe();
  return { title: dict.notFound.metaTitle, description: dict.notFound.metaDescription };
}

export default async function NotFound() {
  const dict = await getDictionarySafe();
  return <NotFoundClient dict={dict.notFound} />;
}
