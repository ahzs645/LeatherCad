import type { TranslationMap } from './translation-ops'
import { INTERFACE_SHELL_DICTIONARIES } from './locale-interface-shell'
import { RECOVERY_DICTIONARIES } from './locale-recovery'
import { SPECIALIST_CONTROL_DICTIONARIES } from './locale-specialist-controls'
import { NATIVE_EDITOR_DICTIONARIES } from './locale-native-editor'

// The same main editing actions are translated in every selectable language.
// Advanced dialogs fall back to English unless the locale supplies more keys.
export const SHELL_TRANSLATION_KEYS = [
  'Draft', 'Modify', 'Piece', 'Stitch', 'Output', 'Save', 'Open', 'Undo', 'Redo',
  'Options', 'Help', 'Language', 'Document', 'Select', 'Line', 'Rectangle',
  'Circle', 'Arc', 'Text', 'Move', 'Mirror', 'Layers', 'Pieces', 'Seams',
  'Inspect', 'View', 'File', 'Tools', 'Copy', 'Paste', 'Delete', 'Create',
  'Print', 'Cancel', 'Apply', 'Done', 'Close', 'Import', 'Export', 'Projects',
  '2D Draft', '3D Assembly', 'Both', 'Precision', 'File tools', 'Import DXF',
  'Export STL', 'Cloud',
] as const

const SHELL_WORDS: Record<string, readonly string[]> = {
  hy: [
    'Գծագրում', 'Խմբագրում', 'Մաս', 'Կար', 'Արտածում', 'Պահպանել', 'Բացել', 'Հետարկել', 'Կրկնել',
    'Կարգավորումներ', 'Օգնություն', 'Լեզու', 'Փաստաթուղթ', 'Ընտրել', 'Գիծ', 'Ուղղանկյուն',
    'Շրջան', 'Աղեղ', 'Տեքստ', 'Տեղափոխել', 'Հայելային արտացոլում', 'Շերտեր', 'Մասեր', 'Կարեր',
    'Մանրամասներ', 'Տեսք', 'Ֆայլ', 'Գործիքներ', 'Պատճենել', 'Տեղադրել', 'Ջնջել', 'Ստեղծել',
    'Տպել', 'Չեղարկել', 'Կիրառել', 'Պատրաստ է', 'Փակել', 'Ներմուծել', 'Արտահանել', 'Նախագծեր',
    '2D գծագիր', '3D հավաքում', 'Երկուսն էլ', 'Ճշգրիտ մուտք', 'Ֆայլերի գործիքներ', 'Ներմուծել DXF',
    'Արտահանել STL', 'Ամպ',
  ],
  da: [
    'Tegn', 'Rediger', 'Del', 'Sting', 'Output', 'Gem', 'Åbn', 'Fortryd', 'Gentag',
    'Indstillinger', 'Hjælp', 'Sprog', 'Dokument', 'Vælg', 'Linje', 'Rektangel',
    'Cirkel', 'Bue', 'Tekst', 'Flyt', 'Spejl', 'Lag', 'Dele', 'Sømme',
    'Egenskaber', 'Visning', 'Fil', 'Værktøjer', 'Kopiér', 'Indsæt', 'Slet', 'Opret',
    'Udskriv', 'Annuller', 'Anvend', 'Færdig', 'Luk', 'Importér', 'Eksportér', 'Projekter',
    '2D-tegning', '3D-samling', 'Begge', 'Præcis indtastning', 'Filværktøjer', 'Importér DXF',
    'Eksportér STL', 'Sky',
  ],
  de: [
    'Zeichnen', 'Bearbeiten', 'Schnittteil', 'Stich', 'Ausgabe', 'Speichern', 'Öffnen', 'Rückgängig', 'Wiederholen',
    'Einstellungen', 'Hilfe', 'Sprache', 'Dokument', 'Auswählen', 'Linie', 'Rechteck',
    'Kreis', 'Bogen', 'Text', 'Verschieben', 'Spiegeln', 'Ebenen', 'Schnittteile', 'Nähte',
    'Eigenschaften', 'Ansicht', 'Datei', 'Werkzeuge', 'Kopieren', 'Einfügen', 'Löschen', 'Erstellen',
    'Drucken', 'Abbrechen', 'Anwenden', 'Fertig', 'Schließen', 'Importieren', 'Exportieren', 'Projekte',
    '2D-Zeichnung', '3D-Montage', 'Beide', 'Präzise Eingabe', 'Dateiwerkzeuge', 'DXF importieren',
    'STL exportieren', 'Cloud',
  ],
  es: [
    'Dibujar', 'Modificar', 'Pieza', 'Puntada', 'Salida', 'Guardar', 'Abrir', 'Deshacer', 'Rehacer',
    'Opciones', 'Ayuda', 'Idioma', 'Documento', 'Seleccionar', 'Línea', 'Rectángulo',
    'Círculo', 'Arco', 'Texto', 'Mover', 'Reflejar', 'Capas', 'Piezas', 'Costuras',
    'Propiedades', 'Vista', 'Archivo', 'Herramientas', 'Copiar', 'Pegar', 'Eliminar', 'Crear',
    'Imprimir', 'Cancelar', 'Aplicar', 'Listo', 'Cerrar', 'Importar', 'Exportar', 'Proyectos',
    'Dibujo 2D', 'Montaje 3D', 'Ambos', 'Entrada precisa', 'Herramientas de archivo', 'Importar DXF',
    'Exportar STL', 'Nube',
  ],
  fi: [
    'Piirrä', 'Muokkaa', 'Kaavakappale', 'Pisto', 'Tulostus', 'Tallenna', 'Avaa', 'Kumoa', 'Tee uudelleen',
    'Asetukset', 'Ohje', 'Kieli', 'Asiakirja', 'Valitse', 'Viiva', 'Suorakulmio',
    'Ympyrä', 'Kaari', 'Teksti', 'Siirrä', 'Peilaa', 'Tasot', 'Kaavakappaleet', 'Saumat',
    'Ominaisuudet', 'Näkymä', 'Tiedosto', 'Työkalut', 'Kopioi', 'Liitä', 'Poista', 'Luo',
    'Tulosta', 'Peruuta', 'Käytä', 'Valmis', 'Sulje', 'Tuo', 'Vie', 'Projektit',
    '2D-piirros', '3D-kokoonpano', 'Molemmat', 'Tarkka syöttö', 'Tiedostotyökalut', 'Tuo DXF',
    'Vie STL', 'Pilvi',
  ],
  fr: [
    'Dessiner', 'Modifier', 'Pièce', 'Point', 'Sortie', 'Enregistrer', 'Ouvrir', 'Annuler', 'Rétablir',
    'Options', 'Aide', 'Langue', 'Document', 'Sélectionner', 'Ligne', 'Rectangle',
    'Cercle', 'Arc', 'Texte', 'Déplacer', 'Symétrie', 'Calques', 'Pièces', 'Coutures',
    'Propriétés', 'Affichage', 'Fichier', 'Outils', 'Copier', 'Coller', 'Supprimer', 'Créer',
    'Imprimer', 'Annuler', 'Appliquer', 'Terminé', 'Fermer', 'Importer', 'Exporter', 'Projets',
    'Dessin 2D', 'Assemblage 3D', 'Les deux', 'Saisie précise', 'Outils de fichier', 'Importer DXF',
    'Exporter STL', 'Cloud',
  ],
  it: [
    'Disegna', 'Modifica', 'Pezzo', 'Punto', 'Uscita', 'Salva', 'Apri', 'Annulla', 'Ripristina',
    'Opzioni', 'Aiuto', 'Lingua', 'Documento', 'Seleziona', 'Linea', 'Rettangolo',
    'Cerchio', 'Arco', 'Testo', 'Sposta', 'Specchia', 'Livelli', 'Pezzi', 'Cuciture',
    'Proprietà', 'Vista', 'File', 'Strumenti', 'Copia', 'Incolla', 'Elimina', 'Crea',
    'Stampa', 'Annulla', 'Applica', 'Fine', 'Chiudi', 'Importa', 'Esporta', 'Progetti',
    'Disegno 2D', 'Assemblaggio 3D', 'Entrambi', 'Inserimento preciso', 'Strumenti file', 'Importa DXF',
    'Esporta STL', 'Cloud',
  ],
  ko: [
    '그리기', '수정', '패턴 조각', '스티치', '출력', '저장', '열기', '실행 취소', '다시 실행',
    '설정', '도움말', '언어', '문서', '선택', '직선', '직사각형',
    '원', '원호', '텍스트', '이동', '대칭', '레이어', '패턴 조각', '솔기',
    '속성', '보기', '파일', '도구', '복사', '붙여넣기', '삭제', '만들기',
    '인쇄', '취소', '적용', '완료', '닫기', '가져오기', '내보내기', '프로젝트',
    '2D 도면', '3D 조립', '둘 다', '정밀 입력', '파일 도구', 'DXF 가져오기',
    'STL 내보내기', '클라우드',
  ],
  no: [
    'Tegn', 'Rediger', 'Mønsterdel', 'Sting', 'Utdata', 'Lagre', 'Åpne', 'Angre', 'Gjør om',
    'Innstillinger', 'Hjelp', 'Språk', 'Dokument', 'Velg', 'Linje', 'Rektangel',
    'Sirkel', 'Bue', 'Tekst', 'Flytt', 'Speil', 'Lag', 'Mønsterdeler', 'Sømmer',
    'Egenskaper', 'Visning', 'Fil', 'Verktøy', 'Kopier', 'Lim inn', 'Slett', 'Opprett',
    'Skriv ut', 'Avbryt', 'Bruk', 'Ferdig', 'Lukk', 'Importer', 'Eksporter', 'Prosjekter',
    '2D-tegning', '3D-montering', 'Begge', 'Presis inntasting', 'Filverktøy', 'Importer DXF',
    'Eksporter STL', 'Sky',
  ],
  pl: [
    'Rysuj', 'Edytuj', 'Część', 'Ścieg', 'Wyjście', 'Zapisz', 'Otwórz', 'Cofnij', 'Ponów',
    'Ustawienia', 'Pomoc', 'Język', 'Dokument', 'Zaznacz', 'Linia', 'Prostokąt',
    'Okrąg', 'Łuk', 'Tekst', 'Przesuń', 'Odbij', 'Warstwy', 'Części', 'Szwy',
    'Właściwości', 'Widok', 'Plik', 'Narzędzia', 'Kopiuj', 'Wklej', 'Usuń', 'Utwórz',
    'Drukuj', 'Anuluj', 'Zastosuj', 'Gotowe', 'Zamknij', 'Importuj', 'Eksportuj', 'Projekty',
    'Rysunek 2D', 'Montaż 3D', 'Oba', 'Dokładne wprowadzanie', 'Narzędzia plików', 'Importuj DXF',
    'Eksportuj STL', 'Chmura',
  ],
  'pt-BR': [
    'Desenhar', 'Modificar', 'Peça', 'Ponto', 'Saída', 'Salvar', 'Abrir', 'Desfazer', 'Refazer',
    'Opções', 'Ajuda', 'Idioma', 'Documento', 'Selecionar', 'Linha', 'Retângulo',
    'Círculo', 'Arco', 'Texto', 'Mover', 'Espelhar', 'Camadas', 'Peças', 'Costuras',
    'Propriedades', 'Visualização', 'Arquivo', 'Ferramentas', 'Copiar', 'Colar', 'Excluir', 'Criar',
    'Imprimir', 'Cancelar', 'Aplicar', 'Concluído', 'Fechar', 'Importar', 'Exportar', 'Projetos',
    'Desenho 2D', 'Montagem 3D', 'Ambos', 'Entrada precisa', 'Ferramentas de arquivo', 'Importar DXF',
    'Exportar STL', 'Nuvem',
  ],
  pt: [
    'Desenhar', 'Modificar', 'Peça', 'Ponto', 'Saída', 'Guardar', 'Abrir', 'Desfazer', 'Refazer',
    'Opções', 'Ajuda', 'Idioma', 'Documento', 'Selecionar', 'Linha', 'Retângulo',
    'Círculo', 'Arco', 'Texto', 'Mover', 'Espelhar', 'Camadas', 'Peças', 'Costuras',
    'Propriedades', 'Vista', 'Ficheiro', 'Ferramentas', 'Copiar', 'Colar', 'Eliminar', 'Criar',
    'Imprimir', 'Cancelar', 'Aplicar', 'Concluído', 'Fechar', 'Importar', 'Exportar', 'Projetos',
    'Desenho 2D', 'Montagem 3D', 'Ambos', 'Entrada precisa', 'Ferramentas de ficheiro', 'Importar DXF',
    'Exportar STL', 'Nuvem',
  ],
  ro: [
    'Desenează', 'Modifică', 'Piesă', 'Cusătură', 'Ieșire', 'Salvează', 'Deschide', 'Anulează', 'Refă',
    'Opțiuni', 'Ajutor', 'Limbă', 'Document', 'Selectează', 'Linie', 'Dreptunghi',
    'Cerc', 'Arc', 'Text', 'Mută', 'Oglindește', 'Straturi', 'Piese', 'Îmbinări',
    'Proprietăți', 'Vizualizare', 'Fișier', 'Instrumente', 'Copiază', 'Lipește', 'Șterge', 'Creează',
    'Tipărește', 'Anulează', 'Aplică', 'Gata', 'Închide', 'Importă', 'Exportă', 'Proiecte',
    'Desen 2D', 'Asamblare 3D', 'Ambele', 'Introducere precisă', 'Instrumente fișiere', 'Importă DXF',
    'Exportă STL', 'Cloud',
  ],
  ru: [
    'Черчение', 'Изменение', 'Деталь', 'Стежок', 'Вывод', 'Сохранить', 'Открыть', 'Отменить', 'Повторить',
    'Настройки', 'Справка', 'Язык', 'Документ', 'Выбрать', 'Линия', 'Прямоугольник',
    'Окружность', 'Дуга', 'Текст', 'Переместить', 'Отразить', 'Слои', 'Детали', 'Швы',
    'Свойства', 'Вид', 'Файл', 'Инструменты', 'Копировать', 'Вставить', 'Удалить', 'Создать',
    'Печать', 'Отмена', 'Применить', 'Готово', 'Закрыть', 'Импорт', 'Экспорт', 'Проекты',
    'Чертёж 2D', 'Сборка 3D', 'Оба', 'Точный ввод', 'Работа с файлами', 'Импорт DXF',
    'Экспорт STL', 'Облако',
  ],
  tr: [
    'Çizim', 'Düzenle', 'Parça', 'Dikiş', 'Çıktı', 'Kaydet', 'Aç', 'Geri al', 'Yinele',
    'Ayarlar', 'Yardım', 'Dil', 'Belge', 'Seç', 'Çizgi', 'Dikdörtgen',
    'Çember', 'Yay', 'Metin', 'Taşı', 'Aynala', 'Katmanlar', 'Parçalar', 'Dikişler',
    'Özellikler', 'Görünüm', 'Dosya', 'Araçlar', 'Kopyala', 'Yapıştır', 'Sil', 'Oluştur',
    'Yazdır', 'İptal', 'Uygula', 'Tamam', 'Kapat', 'İçe aktar', 'Dışa aktar', 'Projeler',
    '2D çizim', '3D montaj', 'İkisi', 'Hassas giriş', 'Dosya araçları', 'DXF içe aktar',
    'STL dışa aktar', 'Bulut',
  ],
  uk: [
    'Креслення', 'Редагування', 'Деталь', 'Стежок', 'Виведення', 'Зберегти', 'Відкрити', 'Скасувати', 'Повторити',
    'Налаштування', 'Довідка', 'Мова', 'Документ', 'Вибрати', 'Лінія', 'Прямокутник',
    'Коло', 'Дуга', 'Текст', 'Перемістити', 'Віддзеркалити', 'Шари', 'Деталі', 'Шви',
    'Властивості', 'Вигляд', 'Файл', 'Інструменти', 'Копіювати', 'Вставити', 'Видалити', 'Створити',
    'Друк', 'Скасувати', 'Застосувати', 'Готово', 'Закрити', 'Імпорт', 'Експорт', 'Проєкти',
    'Креслення 2D', 'Складання 3D', 'Обидва', 'Точне введення', 'Робота з файлами', 'Імпорт DXF',
    'Експорт STL', 'Хмара',
  ],
  'zh-TW': [
    '繪圖', '修改', '裁片', '縫孔', '輸出', '儲存', '開啟', '復原', '重做',
    '設定', '說明', '語言', '文件', '選取', '直線', '矩形',
    '圓形', '圓弧', '文字', '移動', '鏡射', '圖層', '裁片', '接縫',
    '屬性', '檢視', '檔案', '工具', '複製', '貼上', '刪除', '建立',
    '列印', '取消', '套用', '完成', '關閉', '匯入', '匯出', '專案',
    '2D 繪圖', '3D 組裝', '兩者', '精確輸入', '檔案工具', '匯入 DXF',
    '匯出 STL', '雲端',
  ],
  'zh-CN': [
    '绘图', '修改', '裁片', '缝孔', '输出', '保存', '打开', '撤销', '重做',
    '设置', '帮助', '语言', '文档', '选择', '直线', '矩形',
    '圆形', '圆弧', '文字', '移动', '镜像', '图层', '裁片', '接缝',
    '属性', '视图', '文件', '工具', '复制', '粘贴', '删除', '创建',
    '打印', '取消', '应用', '完成', '关闭', '导入', '导出', '项目',
    '2D 绘图', '3D 组装', '两者', '精确输入', '文件工具', '导入 DXF',
    '导出 STL', '云端',
  ],
}

export const SHELL_DICTIONARIES: Record<string, TranslationMap> = Object.fromEntries(
  Object.entries(SHELL_WORDS).map(([locale, values]) => {
    if (values.length !== SHELL_TRANSLATION_KEYS.length) throw new Error(`Incomplete interface dictionary: ${locale}`)
    const entries: TranslationMap = Object.fromEntries(SHELL_TRANSLATION_KEYS.map((key, index) => [key, values[index]]))
    Object.assign(entries, INTERFACE_SHELL_DICTIONARIES[locale])
    Object.assign(entries, RECOVERY_DICTIONARIES[locale])
    Object.assign(entries, SPECIALIST_CONTROL_DICTIONARIES[locale])
    Object.assign(entries, NATIVE_EDITOR_DICTIONARIES[locale])
    entries.Drafting = entries.Draft
    entries.Assembly = entries['3D Assembly']
    entries.Printing = entries.Print
    // Equivalent labels from the compact ribbon and shared file-tools panel.
    entries['File Tools'] = entries['File tools']
    entries['interchange.title'] = entries['File tools']
    entries['interchange.dxfTitle'] = entries['Import DXF']
    entries['interchange.saveLcad'] = `${entries.Save} LCAD`
    entries['interchange.exportStl'] = entries['Export STL']
    entries['interchange.cloud'] = entries.Cloud
    entries['common.done'] = entries.Done
    entries['Save LCAD'] = `${entries.Save} LCAD`
    entries['Open LCAD'] = `${entries.Open} LCAD`
    entries['DXF In'] = entries['Import DXF']
    entries['STL / Jig'] = entries['Export STL']
    entries['Interface language'] = entries.Language
    return [locale, entries]
  }),
)
