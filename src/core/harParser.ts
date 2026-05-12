import { readJsonFile } from '../utils/fs.js';

type Har = {
  log?: {
    entries?: Array<{
      request?: {
        url?: string;
      };
    }>;
  };
};

export const extractUrlsFromHar = async (harPath: string, pattern: string) => {
  const har = await readJsonFile<Har>(harPath);
  const regex = new RegExp(pattern);
  const urls = new Set<string>();

  for (const entry of har.log?.entries ?? []) {
    const url = entry.request?.url;
    if (url && regex.test(url)) {
      urls.add(url);
    }
  }

  return [...urls].sort();
};
