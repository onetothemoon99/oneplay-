import type { Metadata } from 'next';
import SettingsClient from './SettingsClient';
import { getDictionary } from '../dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.settings.metaTitle, description: dict.settings.metaDescription };
}

export default function Page() {
  return <SettingsClient />;
}
