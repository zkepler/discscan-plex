import { base44 } from '@/api/base44Client';

export async function loadConfig() {
  const records = await base44.entities.PlexConfig.list();
  return records[0] || null;
}

export async function saveConfig(patch) {
  const records = await base44.entities.PlexConfig.list();
  if (records[0]) {
    return base44.entities.PlexConfig.update(records[0].id, patch);
  }
  return base44.entities.PlexConfig.create(patch);
}