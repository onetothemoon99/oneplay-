import type { Metadata } from 'next';
import LibraryClient from './LibraryClient';
import { getGames } from '@/lib/gamesRepo';
import { getDictionary } from '../dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.library.metaTitle, description: dict.library.metaDescription };
}

export default async function Page() {
  const { games, source } = await getGames();

  return (
    <LibraryClient
      games={games}
      // Only surfaced during development, as a hint that the Supabase
      // catalogue has not been created/seeded yet.
      showFallbackNotice={source === 'local' && process.env.NODE_ENV !== 'production'}
    />
  );
}
