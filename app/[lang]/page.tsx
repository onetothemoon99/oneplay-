import type { Metadata } from 'next';
import HomeClient from './HomeClient';
import { getDictionary } from './dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.title, description: dict.meta.description };
}

export default function Page() {
  return <HomeClient />;
}
