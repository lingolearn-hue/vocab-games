/**
 * Topic category taxonomy — parent groups and their leaf children.
 * Shared across all languages; a word's `categories` array stores leaf
 * IDs only (e.g. "animals"), never the parent — the parent/child mapping
 * lives here so the tree can be restructured without touching vocab data.
 *
 * A word may carry 0+ leaf tags. Untagged words are unaffected by any
 * category filter (same convention as the existing 'vulgar' tag).
 *
 * Each node's `labels` is keyed by language code, shown in the target
 * language being studied (falls back to English if a translation is
 * missing for a given language).
 */

export const CATEGORY_TREE = [
  {
    id: 'nature', labels: { en: 'Nature', de: 'Natur', es: 'Naturaleza', fr: 'Nature', ja: '自然', zh: '自然' },
    leaves: [
      { id: 'animals',   labels: { en: 'Animals',   de: 'Tiere',      es: 'Animales', fr: 'Animaux', ja: '動物', zh: '动物' } },
      { id: 'plants',    labels: { en: 'Plants',    de: 'Pflanzen',   es: 'Plantas',  fr: 'Plantes', ja: '植物', zh: '植物' } },
      { id: 'weather',   labels: { en: 'Weather',   de: 'Wetter',     es: 'Clima',    fr: 'Météo',   ja: '天気', zh: '天气' } },
      { id: 'landscape', labels: { en: 'Landscape', de: 'Landschaft', es: 'Paisaje',  fr: 'Paysage', ja: '風景', zh: '风景' } },
    ],
  },
  {
    id: 'people', labels: { en: 'People', de: 'Menschen', es: 'Personas', fr: 'Gens', ja: '人々', zh: '人' },
    leaves: [
      { id: 'family',     labels: { en: 'Family',     de: 'Familie', es: 'Familia',   fr: 'Famille',  ja: '家族', zh: '家庭' } },
      { id: 'body',       labels: { en: 'Body',       de: 'Körper',  es: 'Cuerpo',    fr: 'Corps',    ja: '体',   zh: '身体' } },
      { id: 'emotions',   labels: { en: 'Emotions',   de: 'Gefühle', es: 'Emociones', fr: 'Émotions', ja: '感情', zh: '情感' } },
      { id: 'appearance', labels: { en: 'Appearance', de: 'Aussehen', es: 'Apariencia', fr: 'Apparence', ja: '外見', zh: '外貌' } },
    ],
  },
  {
    id: 'life', labels: { en: 'Life', de: 'Leben', es: 'Vida', fr: 'Vie', ja: '生活', zh: '生活' },
    leaves: [
      { id: 'food',     labels: { en: 'Food',     de: 'Essen',     es: 'Comida', fr: 'Nourriture', ja: '食べ物', zh: '食物' } },
      { id: 'clothing', labels: { en: 'Clothing', de: 'Kleidung',  es: 'Ropa',   fr: 'Vêtements',  ja: '服',     zh: '衣服' } },
      { id: 'home',     labels: { en: 'Home',     de: 'Zuhause',   es: 'Hogar',  fr: 'Maison',     ja: '家',     zh: '家'   } },
      { id: 'shopping', labels: { en: 'Shopping', de: 'Einkaufen', es: 'Compras', fr: 'Achats',    ja: '買い物', zh: '购物' } },
      { id: 'health',   labels: { en: 'Health',   de: 'Gesundheit', es: 'Salud',  fr: 'Santé',      ja: '健康',   zh: '健康' } },
    ],
  },
  {
    id: 'places', labels: { en: 'Places', de: 'Orte', es: 'Lugares', fr: 'Lieux', ja: '場所', zh: '地方' },
    leaves: [
      { id: 'travel',     labels: { en: 'Travel',     de: 'Reisen',      es: 'Viajes',     fr: 'Voyage',     ja: '旅行', zh: '旅行' } },
      { id: 'directions', labels: { en: 'Directions', de: 'Richtungen', es: 'Direcciones', fr: 'Directions', ja: '方向', zh: '方向' } },
      { id: 'countries',  labels: { en: 'Countries',  de: 'Länder',     es: 'Países',      fr: 'Pays',       ja: '国',   zh: '国家' } },
      { id: 'traffic',    labels: { en: 'Traffic',    de: 'Verkehr',    es: 'Tráfico',     fr: 'Circulation', ja: '交通', zh: '交通' } },
    ],
  },
  {
    id: 'society', labels: { en: 'Society', de: 'Sozial', es: 'Sociedad', fr: 'Société', ja: '社会', zh: '社会' },
    leaves: [
      { id: 'work',       labels: { en: 'Work',       de: 'Arbeit',      es: 'Trabajo',    fr: 'Travail',    ja: '仕事', zh: '工作' } },
      { id: 'school',     labels: { en: 'School',     de: 'Schule',      es: 'Escuela',    fr: 'École',      ja: '学校', zh: '学校' } },
      { id: 'economy',    labels: { en: 'Economy',    de: 'Wirtschaft',  es: 'Economía',   fr: 'Économie',   ja: '経済', zh: '经济' } },
      { id: 'sports',     labels: { en: 'Sports',     de: 'Sport',       es: 'Deportes',   fr: 'Sport',      ja: 'スポーツ', zh: '体育' } },
    ],
  },
  {
    id: 'culture', labels: { en: 'Culture', de: 'Kultur', es: 'Cultura', fr: 'Culture', ja: '文化', zh: '文化' },
    leaves: [
      { id: 'time',     labels: { en: 'Time',     de: 'Zeit',      es: 'Tiempo',     fr: 'Temps',      ja: '時間', zh: '时间' } },
      { id: 'politics', labels: { en: 'Politics', de: 'Politik',   es: 'Política',   fr: 'Politique',  ja: '政治', zh: '政治' } },
      { id: 'music',    labels: { en: 'Music',    de: 'Musik',     es: 'Música',     fr: 'Musique',    ja: '音楽', zh: '音乐' } },
      { id: 'art',      labels: { en: 'Art',      de: 'Kunst',     es: 'Arte',       fr: 'Art',        ja: '芸術', zh: '艺术' } },
      { id: 'media',    labels: { en: 'Media',    de: 'Medien',    es: 'Medios',     fr: 'Médias',     ja: 'メディア', zh: '媒体' } },
    ],
  },
  {
    id: 'science', labels: { en: 'Science', de: 'Wissen', es: 'Ciencia', fr: 'Science', ja: '科学', zh: '科学' },
    leaves: [
      { id: 'physics',    labels: { en: 'Physics',    de: 'Physik',   es: 'Física',   fr: 'Physique', ja: '物理', zh: '物理' } },
      { id: 'chemistry',  labels: { en: 'Chemistry',  de: 'Chemie',   es: 'Química',  fr: 'Chimie',   ja: '化学', zh: '化学' } },
      { id: 'biology',    labels: { en: 'Biology',    de: 'Biologie', es: 'Biología', fr: 'Biologie', ja: '生物', zh: '生物' } },
      { id: 'technology', labels: { en: 'Technology', de: 'Technik',  es: 'Tecnología', fr: 'Technologie', ja: '技術', zh: '技术' } },
    ],
  },
  {
    id: 'abstract', labels: { en: 'Abstract', de: 'Abstrakt', es: 'Abstracto', fr: 'Abstrait', ja: '抽象', zh: '抽象' },
    leaves: [
      { id: 'verbs',          labels: { en: 'Verbs',          de: 'Verben',            es: 'Verbos',           fr: 'Verbes',           ja: '動詞',     zh: '动词' } },
      { id: 'function_words', labels: { en: 'Function Words', de: 'Funktionswörter',   es: 'Palabras funcionales', fr: 'Mots-outils',  ja: '機能語',   zh: '虚词' } },
      { id: 'quantity',       labels: { en: 'Quantity',       de: 'Menge',             es: 'Cantidad',         fr: 'Quantité',         ja: '数量',     zh: '数量' } },
      { id: 'concepts',       labels: { en: 'Concepts',       de: 'Konzepte',          es: 'Conceptos',        fr: 'Concepts',         ja: '概念',     zh: '概念' } },
      { id: 'grammar',        labels: { en: 'Grammar',        de: 'Grammatik',         es: 'Gramática',        fr: 'Grammaire',        ja: '文法',     zh: '语法' } },
    ],
  },
]

/** Resolve a labels map to a specific language, falling back to English. */
export function resolveLabel(labels, lang) {
  return labels[lang] ?? labels.en
}

/** Flat lookup: leaf id -> { parentId, parentLabels, leafLabels } */
export const LEAF_INFO = CATEGORY_TREE.reduce((acc, parent) => {
  for (const leaf of parent.leaves) {
    acc[leaf.id] = { parentId: parent.id, parentLabels: parent.labels, leafLabels: leaf.labels }
  }
  return acc
}, {})

export function leavesForParent(parentId) {
  return CATEGORY_TREE.find(p => p.id === parentId)?.leaves ?? []
}
