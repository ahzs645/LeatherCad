import type { TranslationMap } from './translation-ops'

export const INTERFACE_SHELL_KEYS = ['Search settings', 'Workspace preset', 'Canvas first', 'Cubic curve', 'Ellipse', 'Apply geometry'] as const
const words: Record<string, readonly string[]> = {
  hy: ['Որոնել կարգավորումները', 'Աշխատանքային տարածքի նախադրվածք', 'Նախ՝ կտավը', 'Խորանարդային կոր', 'Էլիպս', 'Կիրառել երկրաչափությունը'],
  da: ['Søg indstillinger', 'Arbejdsområdeskabelon', 'Lærred først', 'Kubisk kurve', 'Ellipse', 'Anvend geometri'],
  de: ['Einstellungen suchen', 'Arbeitsbereichsvorlage', 'Zeichenfläche zuerst', 'Kubische Kurve', 'Ellipse', 'Geometrie anwenden'],
  es: ['Buscar ajustes', 'Preajuste del espacio de trabajo', 'Priorizar lienzo', 'Curva cúbica', 'Elipse', 'Aplicar geometría'],
  fi: ['Hae asetuksia', 'Työtilan esiasetus', 'Piirtoalue ensin', 'Kuutioinen käyrä', 'Ellipsi', 'Aseta geometria'],
  fr: ['Rechercher dans les paramètres', 'Préréglage de l’espace de travail', 'Priorité au canevas', 'Courbe cubique', 'Ellipse', 'Appliquer la géométrie'],
  it: ['Cerca impostazioni', 'Preimpostazione area di lavoro', 'Priorità alla tela', 'Curva cubica', 'Ellisse', 'Applica geometria'],
  ko: ['설정 검색', '작업 공간 프리셋', '캔버스 우선', '3차 곡선', '타원', '형상 적용'],
  no: ['Søk i innstillinger', 'Forhåndsinnstilling for arbeidsområde', 'Lerret først', 'Kubisk kurve', 'Ellipse', 'Bruk geometri'],
  pl: ['Szukaj ustawień', 'Ustawienie obszaru roboczego', 'Najpierw płótno', 'Krzywa sześcienna', 'Elipsa', 'Zastosuj geometrię'],
  'pt-BR': ['Pesquisar configurações', 'Predefinição do espaço de trabalho', 'Priorizar tela', 'Curva cúbica', 'Elipse', 'Aplicar geometria'],
  pt: ['Pesquisar definições', 'Predefinição da área de trabalho', 'Priorizar tela', 'Curva cúbica', 'Elipse', 'Aplicar geometria'],
  ro: ['Caută setări', 'Presetare spațiu de lucru', 'Prioritate pânză', 'Curbă cubică', 'Elipsă', 'Aplică geometria'],
  ru: ['Поиск настроек', 'Преднастройка рабочей области', 'Холст в приоритете', 'Кубическая кривая', 'Эллипс', 'Применить геометрию'],
  tr: ['Ayarlarda ara', 'Çalışma alanı önayarı', 'Tuval öncelikli', 'Kübik eğri', 'Elips', 'Geometriyi uygula'],
  uk: ['Пошук налаштувань', 'Набір робочого простору', 'Полотно в пріоритеті', 'Кубічна крива', 'Еліпс', 'Застосувати геометрію'],
  'zh-TW': ['搜尋設定', '工作區預設', '畫布優先', '三次曲線', '橢圓', '套用幾何'],
  'zh-CN': ['搜索设置', '工作区预设', '画布优先', '三次曲线', '椭圆', '应用几何'],
}
export const INTERFACE_SHELL_DICTIONARIES: Record<string, TranslationMap> = Object.fromEntries(Object.entries(words).map(([locale, values]) => {
  if (values.length !== INTERFACE_SHELL_KEYS.length) throw new Error(`Incomplete interface follow-up dictionary: ${locale}`)
  const entries = Object.fromEntries(INTERFACE_SHELL_KEYS.map((key, index) => [key, values[index]]))
  return [locale, { ...entries, 'curve.cubic': entries['Cubic curve'], 'curve.ellipse': entries.Ellipse, 'curve.apply': entries['Apply geometry'] }]
}))
