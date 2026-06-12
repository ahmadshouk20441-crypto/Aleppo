/* ═════════════════════════════════════════════════════════════════════════
   ███  بيانات الخريطة — MAP_DATA  ███
   هذا هو القسم الوحيد الذي تحتاج لتعديله لتغيير الخريطة.

   ── المحطات (stations) ──
   كل محطة: المعرّف: st('الاسم الظاهر', x, y, مكان_الاسم)
   مكان الاسم: 'T' فوق · 'B' تحت · 'R' يمين · 'L' يسار
   أو كائن مخصّص: {dx:إزاحة أفقية, dy:إزاحة رأسية, a:'start|middle|end'}
   يمكن كسر الاسم لسطرين بوضع | داخله، مثل: 'دوار|المالية'

   ── الخطوط (lines) ──
   كل خط: { id, name (الاسم), type ('باص' أو 'سرفيس'), color (اللون),
            paths: [ { stops:[قائمة معرفات المحطات بالترتيب],
                       oneWay:true  ← إن كان المسار باتجاه واحد (حلقة)
                       via:{'محطة>محطة':[[x,y],...]} ← نقاط انعطاف اختيارية } ] }
   ملاحظة: الخط الواحد قد يضم عدة مسارات (فرع رئيسي + حلقة + تفرّع).
   ═════════════════════════════════════════════════════════════════════════ */

function st(name, x, y, label){ return {name, x, y, label: label || 'T'}; }

const MAP_DATA = {

stations: {
  /* ── الشمال الغربي: حي الزهراء وشارع النيل ── */
  zahraa:    st('الزهراء|جامع عائشة', 220, 120, 'T'),
  maliyeh:   st('دوار|المالية',       370, 120, 'T'),
  sihha:     st('اشارات|الصحة',       550, 120, 'T'),
  tibb:      st('دوار الطب|العربي',   715, 120, 'T'),
  nahhas:    st('دوار|النحاس',        870, 120, 'T'),
  dalleh:    st('دوار|الدلة',        1020, 120, 'T'),
  adli:      st('القصر|العدلي',       150, 240, 'L'),
  qurtuba:   st('دوار قرطبة',         280, 240, 'B'),
  mekanik:   st('المكانيك',           410, 240, 'B'),
  amara:     st('دوار|العمارة',       550, 240, {dx:-13, dy:-26, a:'start'}),
  bulman:    st('دوار|البولمان',      700, 240, 'T'),
  muhafaza:  st('دوار|المحافظة',      940, 240, 'T'),

  /* ── المحور الشمالي (الدائري الشمالي + المعري) ── */
  rahman:    st('جامع|الرحمن',       1020, 240, 'T'),
  siryan:    st('إشارات|السريان',    1110, 240, 'T'),
  tishrin:   st('جسر|تشرين',         1200, 240, 'T'),
  slemaniyeh:st('السليمانية',        1290, 240, 'T'),
  maari:     st('مدرسة|المعري',      1380, 240, 'T'),
  awared:    st('العوارض',           1470, 240, 'T'),
  maydan:    st('الميدان',           1560, 240, 'T'),
  sulhalabi: st('سليمان|الحلبي',     1650, 330, 'R'),
  sakhour:   st('دوار|الصاخور',      1650, 420, 'R'),

  /* ── وسط الشمال ── */
  sakhra:    st('دوار|الصخرة',        550, 330, 'B'),
  aburisha:  st('دوار ابو ريشة',      850, 330, 'R'),
  amrikan:   st('الأميركان',          660, 330, 'T'),

  /* ── الغرب: حلب الجديدة ── */
  newtown:   st('إشارات|نيوتاون',     150, 330, 'L'),
  saadjd:    st('جامع سعد|(حلب الجديدة)', 280, 330, 'R'),
  shahba:    st('مشفى|الشهباء',       150, 430, 'L'),
  shifa:     st('دوار الشفا',         280, 430, 'T'),
  saleh:     st('دوار الصالح',        380, 430, 'T'),
  shurta:    st('دوار الشرطة',        490, 430, 'B'),
  sakan:     st('السكن',              590, 430, 'T'),
  rajaa:     st('مشفى|الرجاء',        150, 575, 'L'),
  rahmeh:    st('دوار|الرحمة',        280, 575, 'B'),
  sanam:     st('دوار الصنم',         380, 540, 'R'),
  mustaqbal: st('مفرق مشفى|المستقبل', 380, 660, 'R'),
  itfaiyeh:  st('دوار|الاطفائية',     380, 765, 'R'),
  d3000:     st('دوار|3000',          278, 765, 'T'),
  rowad:     st('دوار جمعية|الرواد',  150, 765, 'L'),

  /* ── المركز: ساحة الجامعة وساحة سعدالله ── */
  jamia:     st('ساحة|الجامعة',       730, 400, {dx:-34, dy:52, a:'start', big:true, hub:true}),
  adonis:    st('ادونيس',             965, 435, {dx:22, dy:-12, a:'end'}),
  jamilia:   st('الجميلية',          1090, 435, 'T'),
  saadallah: st('ساحة|سعدالله',      1245, 435, {dx:10, dy:-46, a:'end', big:true, hub:true}),
  faraj:     st('ساعة|باب الفرج',    1405, 435, 'T'),

  /* ── المدينة القديمة ── */
  kaaka:     st('جسر|كعكة',           965, 575, {dx:-20, dy:-4, a:'start'}),
  shohada:   st('نزلة جامع|الشهداء', 1105, 575, 'T'),
  baladi:    st('القصر|البلدي',      1215, 575, 'B'),
  sabbahrat: st('سبع|بحرات',         1310, 575, 'T'),
  babnasr:   st('باب|النصر',         1405, 575, 'R'),
  hadid:     st('باب|الحديد',        1405, 735, {dx:-14, dy:-26, a:'start'}),
  qubbeh:    st('جب|القبة',          1545, 735, 'B'),
  qalaa:     st('القلعة',            1545, 580, 'T'),

  /* ── الشرق ── */
  shaar:     st('دوار|الشعار',       1650, 575, 'R'),
  qadi:      st('قاضي|عسكر',         1650, 765, 'R'),
  nayrab:    st('باب|النيرب',        1540, 875, 'B'),
  salhin:    st('صالحين',            1430, 875, 'T'),
  ferdous:   st('فردوس',             1320, 875, 'T'),

  /* ── الجنوب: محور السكري ── */
  zahra_b:   st('بستان|الزهرة',      1105, 660, 'R'),
  qasr_b:    st('بستان|القصر',       1105, 765, 'R'),
  hajj:      st('جسر الحج',          1105, 875, {dx:14, dy:-12, a:'end'}),
  sukkari:   st('حديقة السكري',      1105, 945, 'R'),
  madaris:   st('تجمع المدارس',      1105, 1015, 'R'),
  zarazir:   st('تل الزرازير',       1105, 1080, 'R'),
  ramouseh:  st('الراموسة',          1105, 1145, 'R'),

  /* ── الجنوب الغربي: صلاح الدين وسيف الدولة ── */
  kura:      st('دوار|الكرة',         730, 665, 'R'),
  diyafeh:   st('قصر الضيافة',        578, 770, 'T'),
  mawlat:    st('المولات',            730, 770, 'R'),
  aazamiyeh: st('الأعظمية',           578, 875, {dx:-14, dy:5, a:'start'}),
  nasrmosq:  st('جامع النصر',         730, 875, 'R'),
  seif:      st('سيف الدولة',         730, 985, 'B'),
  bazerkan:  st('بازركان',            578, 985, 'B'),
  bilal:     st('جامع بلال',          440, 985, 'B'),
  saadsd:    st('جامع سعد|(صلاح الدين)', 440, 880, 'T'),
  dsd:       st('دوار صلاح الدين',    288, 880, 'T'),
  jsd:       st('جامع|صلاح الدين',    288, 985, 'B'),
  hashkal:   st('حارة الحشكل',        150, 985, 'L'),
},

lines: [
  { id:'njs', name:'حلب الجديدة جنوبي', type:'باص', color:'#16694a',
    paths:[ { stops:['rajaa','rahmeh','shifa','saleh','shurta','amrikan','jamia','adonis','jamilia','saadallah','baladi'],
              via:{ 'shurta>amrikan':[[490,330]], 'jamia>adonis':[[930,400]], 'saadallah>baladi':[[1245,545]] } } ] },

  { id:'njn', name:'حلب الجديدة شمالي', type:'باص', color:'#cfa42b',
    paths:[ { stops:['saadjd','newtown','shahba','shifa','saleh','shurta','sakan','jamia','adonis','jamilia','saadallah','baladi'],
              via:{ 'sakan>jamia':[[700,430]], 'jamia>adonis':[[930,400]], 'saadallah>baladi':[[1245,545]] } } ] },

  { id:'salah', name:'صلاح الدين', type:'باص', color:'#2e93dd',
    paths:[
      { stops:['hashkal','jsd','dsd','saadsd','bilal','bazerkan'] },
      /* حلقة باتجاه واحد عبر سيف الدولة والمولات: */
      { stops:['bazerkan','seif','nasrmosq','mawlat','diyafeh','aazamiyeh','bazerkan'], oneWay:true },
      { stops:['mawlat','kura','jamia','adonis','kaaka','shohada','baladi'],
        via:{ 'jamia>adonis':[[930,400]] } } ] },

  { id:'nile', name:'شارع النيل (زهراء)', type:'سرفيس', color:'#6fb5a4',
    paths:[
      { stops:['saadallah','rahman','dalleh','nahhas','tibb','sihha'],
        via:{ 'saadallah>rahman':[[1165,355],[1020,355]] } },
      /* حلقة نهاية الخط باتجاه واحد حول حي الزهراء: */
      { stops:['maliyeh','mekanik','qurtuba','adli','zahraa','maliyeh'], oneWay:true,
        via:{ 'maliyeh>mekanik':[[410,120]], 'adli>zahraa':[[150,190]] } },
      { stops:['sihha','amara','mekanik'] } ] },

  { id:'qalaa', name:'القلعة', type:'باص', color:'#e616c6',
    paths:[
      { stops:['jamia','adonis','kaaka','shohada','baladi','sabbahrat','babnasr','faraj','saadallah'],
        via:{ 'jamia>adonis':[[930,400]] } },
      { stops:['babnasr','hadid','qubbeh','qalaa'] } ] },

  { id:'seifd', name:'سيف الدولة', type:'باص', color:'#8c94a3',
    paths:[ { stops:['seif','nasrmosq','mawlat','kura','jamia','aburisha','muhafaza','rahman','saadallah'],
              via:{ 'jamia>aburisha':[[780,400]], 'rahman>saadallah':[[1020,355],[1165,355]] } } ] },

  { id:'sring', name:'الدائري الجنوبي', type:'باص', color:'#2fbf5f',
    paths:[ { stops:['jamia','kura','mawlat','nasrmosq','seif','hajj','ferdous','salhin','nayrab','qadi','shaar','sakhour'],
              via:{ 'seif>hajj':[[995,985]] } } ] },

  { id:'nring', name:'الدائري الشمالي', type:'باص', color:'#8a3ce0',
    paths:[ { stops:['sakhra','amara','bulman','muhafaza','rahman','siryan','tishrin','slemaniyeh','maari','awared','maydan','sulhalabi','sakhour'] } ] },

  { id:'sukari', name:'السكري', type:'باص', color:'#6b2d52',
    paths:[ { stops:['shohada','zahra_b','qasr_b','hajj','sukkari','madaris','zarazir','ramouseh'] } ] },

  { id:'hamd', name:'حمدانية غربي', type:'سرفيس', color:'#e02830',
    paths:[ { stops:['rowad','d3000','itfaiyeh','mustaqbal','sanam','saleh','shurta','sakan','jamia','adonis','kaaka','shohada','baladi'],
              via:{ 'sakan>jamia':[[700,430]], 'jamia>adonis':[[930,400]] } } ] },

  { id:'maarip', name:'المعري', type:'سرفيس', color:'#f29ad6',
    paths:[ { stops:['aburisha','muhafaza','rahman','siryan','tishrin','slemaniyeh','maari'] } ] },
]
};
/* ═══════════════ نهاية بيانات الخريطة ═══════════════ */

export { MAP_DATA, st };
