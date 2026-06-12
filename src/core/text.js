/* — تطبيع النص العربي للبحث الذكي — */
function normAr(s){
  return (s||'')
    .replace(/\|/g,' ')
    .replace(/[\u064B-\u0652\u0640]/g,'')   // تشكيل وتطويل
    .replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه')
    .replace(/[ىئ]/g,'ي').replace(/ؤ/g,'و')
    .replace(/\s+/g,' ').trim().toLowerCase();
}
function dispName(name){ return name.replace(/\|/g,' '); }

export { normAr, dispName };
