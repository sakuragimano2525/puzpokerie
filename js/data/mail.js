// ============================================================
// メールボックス
// ============================================================
const MAIL_DATA = [
  {
    id: 1,
    title: 'ようこそパズリエへ！',
    date: '2026.10.27',
    body: 'このゲームをプレイしていただきありがとうございます！\n冒険を楽しんでください。',
    reward: null,
    received: false,
    unread: true,
  },
    {
    id: 2,
    title: 'ガチャコインをプレゼント！',
    date: '2026.11.02',
    body: 'ガチャコインを1個お届けします\nぜひガチャをまわしてみてね。',
    reward: { item: 'fcoin', count: 1 },
    received: false,
    unread: true,
  },
  {
    id: 3,
    title: 'アルカナエキスをプレゼント！',
    date: '2026.11.02',
    body: 'アルカナエキスを1個お届けします\nぜひてめえはまわしてみてね。',
    reward: { item: 'arukana', count: 1 },
    received: false,
    unread: true,
  },
];
