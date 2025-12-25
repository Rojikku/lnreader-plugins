import { Plugin } from '@/types/plugin';
import { fetchApi } from '@libs/fetch';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { load as parseHTML } from 'cheerio';

class WTRLAB implements Plugin.PluginBase {
  id = 'WTRLAB';
  name = 'WTR-LAB';
  site = 'https://wtr-lab.com/';
  version = '1.0.2';
  icon = 'src/en/wtrlab/icon.png';
  sourceLang = 'en/';

  async popularNovels(
    page: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    let link = this.site + this.sourceLang + 'novel-list?';
    link += `orderBy=${filters.order.value}`;
    link += `&order=${filters.sort.value}`;
    link += `&filter=${filters.storyStatus.value}`;
    link += `&page=${page}`; //TODO Genre & Advance Searching Filter. Ez to implement, too much manual work, too lazy.

    if (showLatestNovels) {
      if (page !== 1) return [];
      const response = await fetchApi(this.site + 'api/home/recent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page: page }),
      });

      const recentNovel: JsonNovel = await response.json();

      // Parse novels from JSON
      const novels: Plugin.NovelItem[] = recentNovel.data.map(
        (datum: Datum) => ({
          name: datum.serie.data.title || datum.serie.slug || '',
          cover: datum.serie.data.image,
          path:
            this.sourceLang +
              'serie-' +
              datum.serie.raw_id +
              '/' +
              datum.serie.slug || '',
        }),
      );

      return novels;
    } else {
      const body = await fetchApi(link).then(res => res.text());
      const loadedCheerio = parseHTML(body);
      const novels: Plugin.NovelItem[] = loadedCheerio('.serie-item')
        .map((index, element) => ({
          name:
            loadedCheerio(element)
              .find('.title-wrap > a')
              .text()
              .replace(loadedCheerio(element).find('.rawtitle').text(), '') ||
            '',
          cover:
            this.site +
            loadedCheerio(element).find('img').attr('src')?.substring(1),
          path: loadedCheerio(element).find('a').attr('href') || '',
        }))
        .get()
        .filter(novel => novel.name && novel.path);
      return novels;
    }
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const body = await fetchApi(this.site + novelPath).then(res => res.text());
    const loadedCheerio = parseHTML(body);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: loadedCheerio('h1.text-uppercase').text(),
      summary: loadedCheerio('.lead').text().trim(),
    };

    novel.genres = loadedCheerio('.genres')
      .find('.genre')
      .map((i, el) => loadedCheerio(el).text())
      .toArray()
      .join(',');

    novel.author = loadedCheerio('td:contains("Author")')
      .next()
      .text()
      .replace(/[\t\n]/g, '');

    novel.status = loadedCheerio('td:contains("Status")')
      .next()
      .text()
      .replace(/[\t\n]/g, '');

    const dataJson = loadedCheerio('#__NEXT_DATA__').html() + '';
    const jsonData: NovelJson = JSON.parse(dataJson);
    const id = jsonData.query.raw_id;

    novel.cover = jsonData.props.pageProps.serie.serie_data.data.image;

    const chapterJsonRaw = await fetchApi(`${this.site}api/chapters/${id}`);
    const chapterJson = await chapterJsonRaw.json();

    const chapters: Plugin.ChapterItem[] = chapterJson.chapters.map(
      jsonChapter => ({
        name: jsonChapter.title,
        path:
          `${this.sourceLang}novel/${id}/` +
          jsonData.props.pageProps.serie.serie_data.slug +
          '/chapter-' +
          jsonChapter.order, // Assuming 'slug' is the intended path
        releaseTime: (
          jsonChapter?.created_at || jsonChapter?.updated_at
        )?.substring(0, 10),
        chapterNumber: jsonChapter.order,
      }),
    );

    novel.chapters = chapters;

    return novel;
  }

  async decrypt(encrypted: string, encKey: string): Promise<string> {
    try {
      // t is set to false here; true if arr:
      // If true we parse as json
      let t = !1,
        u = encrypted;
      // t true if arr:, str: straight, else error
      encrypted.startsWith('arr:')
        ? ((t = !0), (u = encrypted.substring(4)))
        : encrypted.startsWith('str:') && (u = encrypted.substring(4));
      const r = u.split(':');
      if (3 !== r.length) throw Error('Invalid encrypted data format');

      // Remove base64, setup vars
      const [iv, tag, ciphertext] = r.map(part =>
          Uint8Array.from(atob(part), e => e.charCodeAt(0)),
        ),
        combined = new Uint8Array(ciphertext.length + tag.length);

      // Make the ciphertext + tag format expected for decryption
      combined.set(ciphertext), combined.set(tag, ciphertext.length);

      // Decrypt with encKey
      const D = new TextEncoder().encode(encKey.slice(0, 32));
      const d = await crypto.subtle.importKey(
        'raw',
        D,
        { name: 'AES-GCM' },
        !1,
        ['decrypt'],
      );
      const h = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        d,
        combined,
      );
      const m = new TextDecoder().decode(h);

      // If it was arr:, parse as json
      if (t) return JSON.parse(m);
      // Otherwise (str:) return straight
      return m;
    } catch (error) {
      throw (
        (console.error('Client-side decryption error:', error),
        Error('Failed to decrypt content'))
      );
    }
  }

  async getKey($): Promise<string> {
    // Fetch the novel's data in JSON format
    const searchKey = '.slice(0,32)),d=await';

    let URLs = [];
    let code;
    let index = -1;

    // Find URL with API Key
    const srcs = $('head')
      .find('script')
      .map(function () {
        const src = $(this).attr('src');
        if (src in URLs) {
          return null;
        }
        URLs.push(src);
      })
      .toArray();
    for (let src of URLs) {
      const script = await fetchApi(`${this.site}${src}`);
      const raw = await script.text();
      index = raw.indexOf(searchKey);
      if (index >= 0) {
        code = raw;
        break;
      }
    }
    if (!code) {
      throw new Error('Failed to find Encryption Key');
    }
    // Get right segment of code
    const encKey = code.substring(index - 33, index - 1);
    return encKey;
  }

  async translate(data: string[]): Promise<string[]> {
    const contained = data.map((line, i) => `<a i=${i}>${line}</a>`);

    let translated = await fetchApi(
      'https://translate-pa.googleapis.com/v1/translateHtml',
      {
        'credentials': 'omit',
        'headers': {
          'content-type': 'application/json+protobuf',
          // Generic public API key source also uses
          // Seen all over google
          'X-Goog-API-Key': 'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520',
        },
        'referrer': 'https://wtr-lab.com/',
        'body': `[[${JSON.stringify(contained)},\"zh-CN\",\"en\"],\"te_lib\"]`,
        'method': 'POST',
      },
    );
    translated = await translated.json();
    translated = translated[0];
    return translated;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = this.site + chapterPath;
    const body = await fetchApi(url).then(res => res.text());

    const loadedCheerio = parseHTML(body);
    const chapterJson = loadedCheerio('#__NEXT_DATA__').html() + '';
    const jsonData: NovelJson = JSON.parse(chapterJson);

    const chapterID = jsonData.props.pageProps.serie.chapter.id;
    const seriesID = jsonData.props.pageProps.serie.chapter.raw_id;
    const chapterNo = jsonData.props.pageProps.serie.chapter.order;

    const translationTypes = ['ai', 'web'];

    let eLog = '';
    let parsedJson;

    for (const type of translationTypes) {
      const query = {
        'headers': {
          'Content-Type': 'application/json',
        },
        'referrer': url,
        'body': `{
        "translate":"${type}",
        "language":"${this.sourceLang.replace('/', '')}",
        "raw_id":${seriesID},
        "chapter_no":${chapterNo},
        "retry":false,
        "force_retry":false,
        "chapter_id":${chapterID}
        }`,
        'method': 'POST',
      };

      const chapterQuery = await fetchApi(
        'https://wtr-lab.com/api/reader/get',
        query,
      );

      parsedJson = await chapterQuery.json();
      if (parsedJson.error) {
        eLog = parsedJson.error;
        continue;
      } else {
        break;
      }
    }

    let chapterContent = parsedJson.data.data.body;
    const chapterGlossary = parsedJson.data.data.glossary_data;

    let htmlString = '';

    if (
      chapterContent.toString().startsWith('arr:') ||
      chapterContent.toString().startsWith('str:')
    ) {
      const encKey = await this.getKey(loadedCheerio);
      chapterContent = await this.decrypt(chapterContent, encKey);
      chapterContent = await this.translate(chapterContent);
      console.log(chapterContent);
      htmlString += `<p><small>This is being translated from your device via google translate (source's method) - Login via web view to try for ai translations</small></p>`;
    }

    if (eLog !== '') {
      htmlString += `<p style="color:darkred;">${eLog}</p>`;
    }

    let dictionary = [];
    if (chapterGlossary) {
      dictionary = Object.fromEntries(
        chapterGlossary.terms.map((definition, index) => [
          `※${index}⛬`,
          definition[0],
        ]),
      );
    }

    for (let text of chapterContent) {
      if (dictionary.length > 0) {
        text = text.replaceAll(/※[0-9]+⛬/g, m => dictionary[m]);
      }
      htmlString += `<p>${text}</p>`;
    }

    return htmlString;
  }

  async searchNovels(
    searchTerm: string,
    page: number,
  ): Promise<Plugin.SourceNovel[]> {
    if (page !== 1) return [];
    // TODO: This function uses the in-page easy search. There's a better search, it's just harder to access.
    const response = await fetchApi(this.site + 'api/search', {
      headers: {
        'Content-Type': 'application/json',
        Referer: this.site + this.sourceLang + 'novel-list',
      },
      method: 'POST',
      body: JSON.stringify({ text: searchTerm }),
    });

    const recentNovel: JsonNovel = await response.json();

    // Parse novels from JSON
    const novels: Plugin.NovelItem[] = recentNovel.data.map((datum: Datum) => ({
      name: datum.data.title || datum.slug || '',
      cover: datum.data.image,
      path: this.sourceLang + 'serie-' + datum.raw_id + '/' + datum.slug || '',
    }));

    return novels;
  }

  filters = {
    order: {
      value: 'chapter',
      label: 'Order by',
      options: [
        { label: 'View', value: 'view' },
        { label: 'Name', value: 'name' },
        { label: 'Addition Date', value: 'date' },
        { label: 'Reader', value: 'reader' },
        { label: 'Chapter', value: 'chapter' },
      ],
      type: FilterTypes.Picker,
    },
    sort: {
      value: 'desc',
      label: 'Sort by',
      options: [
        { label: 'Descending', value: 'desc' },
        { label: 'Ascending', value: 'asc' },
      ],
      type: FilterTypes.Picker,
    },
    storyStatus: {
      value: 'all',
      label: 'Status',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Ongoing', value: 'ongoing' },
        { label: 'Completed', value: 'completed' },
      ],
      type: FilterTypes.Picker,
    },
  } satisfies Filters;
}

type NovelJson = {
  props: Props;
  page: string;
};

type Props = {
  pageProps: PageProps;
  __N_SSP: boolean;
};

type PageProps = {
  serie: Serie;
  server_time: Date;
};

type Serie = {
  serie_data: SerieData;
  chapter: Chapter;
  recommendation: SerieData[];
  chapter_data: ChapterData;
  id: number;
  raw_id: number;
  slug: string;
  data: Data;
  is_default: boolean;
  raw_type: string;
};

type Chapter = {
  serie_id: number;
  id: number;
  raw_id: number;
  order: number;
  slug: string;
  title: string;
  name: string;
  created_at: string;
  updated_at: string;
};
type ChapterData = {
  data: ChapterContent;
};
type ChapterContent = {
  title: string;
  body: string;
};

type SerieData = {
  serie_id?: number;
  recommendation_id?: number;
  score?: string;
  id: number;
  slug: string;
  search_text: string;
  status: number;
  data: Data;
  created_at: string;
  updated_at: string;
  view: number;
  in_library: number;
  rating: number | null;
  chapter_count: number;
  power: number;
  total_rate: number;
  user_status: number;
  verified: boolean;
  from: null;
  raw_id: number;
  genres?: number[];
};

type Data = {
  title: string;
  author: string;
  description: string;
  image: string;
};

type JsonNovel = {
  success: boolean;
  data: Datum[];
};
type Datum = {
  serie: Serie;
  chapters: Chapter[];
  updated_at: Date;
  raw_id: number;
  slug: string;
  data: Data;
};

export default new WTRLAB();
