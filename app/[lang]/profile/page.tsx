import type { Metadata } from 'next';
import ProfileClient from './ProfileClient';
import { getDictionary } from '../dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.profile.metaTitle, description: dict.profile.metaDescription };
}

export default function Page() {
  return <ProfileClient />;
}
