// ============================================================
// マルチプレイダンジョン（仮）
//   いまは 1-1 と同じ内容をコピーしているだけ（マルチ通信は未対応）。
//   本物のデータができたら、下の「複製」をやめて DUNGEON_DATA['multi-1'] = {...} を直接書く。
//   ※ dungeons.js はダンジョン設定ツールで差し替えるので、マルチ用はこのファイルに分けてある。
//   ※ キーは「マルチID-番号」。マルチIDは areas.js の MULTI_AREA_IDS / EVENT_AREA_DATA と合わせる。
// ============================================================
(function () {
  if (typeof DUNGEON_DATA === 'undefined' || !DUNGEON_DATA['1-1']) return;
  DUNGEON_DATA['multi-1'] = JSON.parse(JSON.stringify(DUNGEON_DATA['1-1']));
  if (typeof DUNGEON_BGM !== 'undefined' && DUNGEON_BGM['1-1']) DUNGEON_BGM['multi-1'] = Object.assign({}, DUNGEON_BGM['1-1']);
})();
