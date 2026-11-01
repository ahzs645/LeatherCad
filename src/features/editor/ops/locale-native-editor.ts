import type { TranslationMap } from './translation-ops'

export const NATIVE_EDITOR_KEYS = ['Start', 'End', 'Center', 'Control 1', 'Control 2', 'Radius X', 'Radius Y', 'Rotation (°)', 'Start angle (°)', 'Sweep (°)', 'Appearance and protection', 'Lock shape', 'Opacity (%)', 'Group parent', 'No parent group'] as const
const labels: Record<string, string> = {
  ja: '始点|終点|中心|制御点1|制御点2|X方向の半径|Y方向の半径|回転 (°)|開始角度 (°)|角度範囲 (°)|外観と保護|図形をロック|不透明度 (%)|親グループ|親グループなし',
  hy: 'Սկիզբ|Վերջ|Կենտրոն|Կառավարման կետ 1|Կառավարման կետ 2|X շառավիղ|Y շառավիղ|Պտույտ (°)|Սկզբնական անկյուն (°)|Անկյունային ընդգրկում (°)|Տեսք և պաշտպանություն|Կողպել պատկերը|Անթափանցություն (%)|Ծնող խումբ|Առանց ծնող խմբի',
  da: 'Start|Slut|Centrum|Kontrolpunkt 1|Kontrolpunkt 2|Radius X|Radius Y|Rotation (°)|Startvinkel (°)|Vinkeludstrækning (°)|Udseende og beskyttelse|Lås figur|Uigennemsigtighed (%)|Overordnet gruppe|Ingen overordnet gruppe',
  de: 'Anfang|Ende|Mittelpunkt|Kontrollpunkt 1|Kontrollpunkt 2|Radius X|Radius Y|Drehung (°)|Startwinkel (°)|Winkelbereich (°)|Darstellung und Schutz|Form sperren|Deckkraft (%)|Übergeordnete Gruppe|Keine übergeordnete Gruppe',
  es: 'Inicio|Fin|Centro|Punto de control 1|Punto de control 2|Radio X|Radio Y|Rotación (°)|Ángulo inicial (°)|Barrido (°)|Apariencia y protección|Bloquear forma|Opacidad (%)|Grupo superior|Sin grupo superior',
  fi: 'Alku|Loppu|Keskipiste|Ohjauspiste 1|Ohjauspiste 2|Säde X|Säde Y|Kierto (°)|Alkukulma (°)|Kulmalaajuus (°)|Ulkoasu ja suojaus|Lukitse muoto|Peittävyys (%)|Yläryhmä|Ei yläryhmää',
  fr: 'Début|Fin|Centre|Point de contrôle 1|Point de contrôle 2|Rayon X|Rayon Y|Rotation (°)|Angle initial (°)|Balayage (°)|Apparence et protection|Verrouiller la forme|Opacité (%)|Groupe parent|Aucun groupe parent',
  it: 'Inizio|Fine|Centro|Punto di controllo 1|Punto di controllo 2|Raggio X|Raggio Y|Rotazione (°)|Angolo iniziale (°)|Ampiezza (°)|Aspetto e protezione|Blocca forma|Opacità (%)|Gruppo superiore|Nessun gruppo superiore',
  ko: '시작점|끝점|중심|제어점 1|제어점 2|X 반지름|Y 반지름|회전 (°)|시작 각도 (°)|스윕 각도 (°)|외관 및 보호|도형 잠금|불투명도 (%)|상위 그룹|상위 그룹 없음',
  no: 'Start|Slutt|Sentrum|Kontrollpunkt 1|Kontrollpunkt 2|Radius X|Radius Y|Rotasjon (°)|Startvinkel (°)|Vinkelutstrekning (°)|Utseende og beskyttelse|Lås figur|Ugjennomsiktighet (%)|Overordnet gruppe|Ingen overordnet gruppe',
  pl: 'Początek|Koniec|Środek|Punkt kontrolny 1|Punkt kontrolny 2|Promień X|Promień Y|Obrót (°)|Kąt początkowy (°)|Rozpiętość (°)|Wygląd i ochrona|Zablokuj kształt|Krycie (%)|Grupa nadrzędna|Brak grupy nadrzędnej',
  'pt-BR': 'Início|Fim|Centro|Ponto de controle 1|Ponto de controle 2|Raio X|Raio Y|Rotação (°)|Ângulo inicial (°)|Varredura (°)|Aparência e proteção|Bloquear forma|Opacidade (%)|Grupo superior|Sem grupo superior',
  pt: 'Início|Fim|Centro|Ponto de controlo 1|Ponto de controlo 2|Raio X|Raio Y|Rotação (°)|Ângulo inicial (°)|Amplitude (°)|Aspeto e proteção|Bloquear forma|Opacidade (%)|Grupo superior|Sem grupo superior',
  ro: 'Început|Sfârșit|Centru|Punct de control 1|Punct de control 2|Rază X|Rază Y|Rotație (°)|Unghi inițial (°)|Deschidere (°)|Aspect și protecție|Blochează forma|Opacitate (%)|Grup părinte|Fără grup părinte',
  ru: 'Начало|Конец|Центр|Контрольная точка 1|Контрольная точка 2|Радиус X|Радиус Y|Поворот (°)|Начальный угол (°)|Угловой размах (°)|Внешний вид и защита|Заблокировать фигуру|Непрозрачность (%)|Родительская группа|Без родительской группы',
  tr: 'Başlangıç|Bitiş|Merkez|Kontrol noktası 1|Kontrol noktası 2|X yarıçapı|Y yarıçapı|Dönüş (°)|Başlangıç açısı (°)|Tarama açısı (°)|Görünüm ve koruma|Şekli kilitle|Opaklık (%)|Üst grup|Üst grup yok',
  uk: 'Початок|Кінець|Центр|Контрольна точка 1|Контрольна точка 2|Радіус X|Радіус Y|Поворот (°)|Початковий кут (°)|Кутовий розмах (°)|Вигляд і захист|Заблокувати фігуру|Непрозорість (%)|Батьківська група|Без батьківської групи',
  'zh-TW': '起點|終點|中心|控制點 1|控制點 2|X 半徑|Y 半徑|旋轉 (°)|起始角度 (°)|掃掠角度 (°)|外觀與保護|鎖定圖形|不透明度 (%)|父群組|無父群組',
  'zh-CN': '起点|终点|中心|控制点 1|控制点 2|X 半径|Y 半径|旋转 (°)|起始角度 (°)|扫掠角度 (°)|外观与保护|锁定图形|不透明度 (%)|父组|无父组',
}
const hints: Record<string, readonly [string, string, string, string]> = {
  ja: ['作図範囲内の有効な座標を入力してください。', '正の半径、有効な角度、0度以外で絶対値が360度以内の角度範囲を入力してください。', 'この図形はグループによって保護されています。編集するにはグループのロックを解除してください。', '親グループの指定が無効です'],
  hy: ['Մուտքագրեք վերջավոր կոորդինատներ գծագրի սահմաններում։', 'Մուտքագրեք դրական շառավիղներ, վերջավոր անկյուններ և ոչ զրոյական ընդգրկում՝ մինչև 360°։', 'Այս պատկերը պաշտպանված է նաև իր խմբով։ Խմբագրելու համար ապակողպեք խումբը։', 'Անվավեր ծնող խումբ'],
  da: ['Angiv endelige koordinater inden for tegningens grænser.', 'Angiv positive radier, endelige vinkler og en vinkeludstrækning forskellig fra nul med en absolutværdi på højst 360°.', 'Figuren er også beskyttet af sin gruppe. Lås gruppen op for at redigere den.', 'Ugyldig overordnet gruppe'],
  de: ['Geben Sie endliche Koordinaten innerhalb der Zeichnungsgrenzen ein.', 'Geben Sie positive Radien, endliche Winkel und einen Winkelbereich größer als null bis 360° ein.', 'Diese Form wird auch durch ihre Gruppe geschützt. Entsperren Sie die Gruppe zum Bearbeiten.', 'Ungültige übergeordnete Gruppe'],
  es: ['Introduzca coordenadas finitas dentro de los límites del dibujo.', 'Introduzca radios positivos, ángulos finitos y un barrido distinto de cero de hasta 360°.', 'Esta forma también está protegida por su grupo. Desbloquee el grupo para editarla.', 'Grupo superior no válido'],
  fi: ['Anna äärelliset koordinaatit piirustuksen rajojen sisällä.', 'Anna positiiviset säteet, äärelliset kulmat ja nollasta poikkeava kulmalaajuus enintään 360°.', 'Myös ryhmä suojaa tätä muotoa. Avaa ryhmän lukitus muokkausta varten.', 'Virheellinen yläryhmä'],
  fr: ['Saisissez des coordonnées finies dans les limites du dessin.', 'Saisissez des rayons positifs, des angles finis et un balayage non nul jusqu’à 360°.', 'Cette forme est aussi protégée par son groupe. Déverrouillez le groupe pour la modifier.', 'Groupe parent non valide'],
  it: ['Inserisci coordinate finite entro i limiti del disegno.', 'Inserisci raggi positivi, angoli finiti e un’ampiezza diversa da zero fino a 360°.', 'Questa forma è protetta anche dal suo gruppo. Sblocca il gruppo per modificarla.', 'Gruppo superiore non valido'],
  ko: ['도면 범위 내의 유한한 좌표를 입력하세요.', '양의 반지름, 유한한 각도, 0이 아니고 360° 이하인 스윕을 입력하세요.', '이 도형은 소속 그룹으로도 보호됩니다. 편집하려면 그룹 잠금을 해제하세요.', '유효하지 않은 상위 그룹'],
  no: ['Angi endelige koordinater innenfor tegningens grenser.', 'Angi positive radier, endelige vinkler og en vinkelutstrekning ulik null med absoluttverdi på høyst 360°.', 'Denne figuren er også beskyttet av gruppen sin. Lås opp gruppen for å redigere den.', 'Ugyldig overordnet gruppe'],
  pl: ['Wprowadź skończone współrzędne w granicach rysunku.', 'Wprowadź dodatnie promienie, skończone kąty i niezerową rozpiętość do 360°.', 'Ten kształt jest chroniony również przez grupę. Odblokuj grupę, aby go edytować.', 'Nieprawidłowa grupa nadrzędna'],
  'pt-BR': ['Insira coordenadas finitas dentro dos limites do desenho.', 'Insira raios positivos, ângulos finitos e uma varredura diferente de zero de até 360°.', 'Esta forma também é protegida pelo grupo. Desbloqueie o grupo para editá-la.', 'Grupo superior inválido'],
  pt: ['Introduza coordenadas finitas dentro dos limites do desenho.', 'Introduza raios positivos, ângulos finitos e uma amplitude diferente de zero até 360°.', 'Esta forma também está protegida pelo grupo. Desbloqueie o grupo para a editar.', 'Grupo superior inválido'],
  ro: ['Introdu coordonate finite în limitele desenului.', 'Introdu raze pozitive, unghiuri finite și o deschidere nenulă de cel mult 360°.', 'Această formă este protejată și de grupul ei. Deblochează grupul pentru a o edita.', 'Grup părinte nevalid'],
  ru: ['Введите конечные координаты в пределах чертежа.', 'Введите положительные радиусы, конечные углы и ненулевой угловой размах до 360°.', 'Эта фигура также защищена своей группой. Разблокируйте группу для редактирования.', 'Недопустимая родительская группа'],
  tr: ['Çizim sınırları içinde sonlu koordinatlar girin.', 'Pozitif yarıçaplar, sonlu açılar ve 360° değerine kadar sıfırdan farklı bir tarama açısı girin.', 'Bu şekil, grubu tarafından da korunuyor. Düzenlemek için grubun kilidini açın.', 'Geçersiz üst grup'],
  uk: ['Введіть скінченні координати в межах креслення.', 'Введіть додатні радіуси, скінченні кути та ненульовий кутовий розмах до 360°.', 'Цю фігуру також захищає її група. Розблокуйте групу для редагування.', 'Недійсна батьківська група'],
  'zh-TW': ['請輸入圖面範圍內的有限座標。', '請輸入正半徑、有限角度，以及不為零且不超過 360° 的掃掠角度。', '此圖形也受到所屬群組保護。請先解除群組鎖定再編輯。', '無效的父群組'],
  'zh-CN': ['请输入图纸范围内的有限坐标。', '请输入正半径、有限角度，以及不为零且不超过 360° 的扫掠角度。', '此图形也受所属组保护。请先解除组锁定再编辑。', '无效的父组'],
}
export const NATIVE_EDITOR_ALIASES: Record<string, string> = { 'curve.start': 'Start', 'curve.end': 'End', 'curve.center': 'Center', 'curve.control1': 'Control 1', 'curve.control2': 'Control 2', 'curve.radiusX': 'Radius X', 'curve.radiusY': 'Radius Y', 'curve.rotation': 'Rotation (°)', 'curve.startAngle': 'Start angle (°)', 'curve.sweep': 'Sweep (°)', 'shape.appearance': 'Appearance and protection', 'shape.lock': 'Lock shape', 'shape.opacity': 'Opacity (%)', 'shape.parentGroup': 'Group parent', 'shape.noParent': 'No parent group' }
export const NATIVE_EDITOR_VALIDATION_KEYS = ['curve.invalidCoordinates', 'curve.invalidEllipse', 'shape.inheritedLock', 'shape.groupInvalid'] as const
export const NATIVE_EDITOR_DICTIONARIES: Record<string, TranslationMap> = Object.fromEntries(Object.entries(labels).map(([locale, row]) => {
  const values = row.split('|')
  if (values.length !== NATIVE_EDITOR_KEYS.length || !hints[locale]) throw new Error(`Incomplete native editor workflow: ${locale}`)
  const dictionary: TranslationMap = Object.fromEntries(NATIVE_EDITOR_KEYS.map((key, index) => [key, values[index]]))
  for (const [key, label] of Object.entries(NATIVE_EDITOR_ALIASES)) dictionary[key] = dictionary[label]
  Object.assign(dictionary, { 'curve.invalidCoordinates': hints[locale][0], 'curve.invalidEllipse': hints[locale][1], 'shape.inheritedLock': hints[locale][2], 'shape.groupInvalid': hints[locale][3] })
  return [locale, dictionary]
}))
