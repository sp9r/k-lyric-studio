(function (root, factory) {
  const hangulApi =
    typeof module === "object" && module.exports
      ? require("./hangul.js")
      : root.KLyricHangul;
  const api = factory(hangulApi);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.KLyricDict = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function (Hangul) {
  const BASE_DICT = {
    // Pronouns & people
    "나": { pos: "代名詞", meaning: "私、僕（タメ口）" },
    "내": { pos: "代名詞", meaning: "私の、僕が" },
    "내가": { pos: "代名詞+助詞", meaning: "私が、僕が" },
    "너": { pos: "代名詞", meaning: "君、あなた" },
    "네": { pos: "代名詞", meaning: "君の（話し言葉では니）" },
    "니가": { pos: "代名詞+助詞", meaning: "君が（口語）" },
    "우리": { pos: "代名詞", meaning: "私たち、うちの" },
    "저": { pos: "代名詞", meaning: "私（丁寧）" },
    "제": { pos: "代名詞", meaning: "私の（丁寧）" },
    "사람": { pos: "名詞", meaning: "人" },
    "친구": { pos: "名詞", meaning: "友達" },
    "멤버": { pos: "名詞", meaning: "メンバー" },
    "팬": { pos: "名詞", meaning: "ファン" },
    "누구": { pos: "代名詞", meaning: "誰" },
    "모두": { pos: "名詞/副詞", meaning: "みんな、すべて" },
    "혼자": { pos: "名詞/副詞", meaning: "一人、一人で" },
    "같이": { pos: "副詞", meaning: "一緒に、〜のように" },
    "함께": { pos: "副詞", meaning: "ともに、一緒に" },

    // Time & place & basic nouns
    "오늘": { pos: "名詞", meaning: "今日" },
    "내일": { pos: "名詞", meaning: "明日" },
    "어제": { pos: "名詞", meaning: "昨日" },
    "지금": { pos: "名詞/副詞", meaning: "今" },
    "항상": { pos: "副詞", meaning: "いつも" },
    "언제나": { pos: "副詞", meaning: "いつでも" },
    "매일": { pos: "名詞/副詞", meaning: "毎日" },
    "순간": { pos: "名詞", meaning: "瞬間" },
    "시간": { pos: "名詞", meaning: "時間" },
    "밤": { pos: "名詞", meaning: "夜" },
    "낮": { pos: "名詞", meaning: "昼" },
    "아침": { pos: "名詞", meaning: "朝" },
    "처음": { pos: "名詞", meaning: "最初、初めて" },
    "마지막": { pos: "名詞", meaning: "最後" },
    "여기": { pos: "代名詞", meaning: "ここ" },
    "거기": { pos: "代名詞", meaning: "そこ" },
    "어디": { pos: "代名詞", meaning: "どこ" },
    "세상": { pos: "名詞", meaning: "世界" },
    "하늘": { pos: "名詞", meaning: "空" },
    "별": { pos: "名詞", meaning: "星" },
    "달": { pos: "名詞", meaning: "月" },
    "빛": { pos: "名詞", meaning: "光" },
    "바람": { pos: "名詞", meaning: "風／願い" },
    "비": { pos: "名詞", meaning: "雨" },
    "눈": { pos: "名詞", meaning: "目／雪" },
    "길": { pos: "名詞", meaning: "道" },
    "집": { pos: "名詞", meaning: "家" },
    "방": { pos: "名詞", meaning: "部屋" },
    "무대": { pos: "名詞", meaning: "ステージ、舞台" },
    "노래": { pos: "名詞", meaning: "歌" },
    "음악": { pos: "名詞", meaning: "音楽" },
    "춤": { pos: "名詞", meaning: "ダンス、踊り" },
    "연습": { pos: "名詞", meaning: "練習" },
    "목소리": { pos: "名詞", meaning: "声" },
    "이름": { pos: "名詞", meaning: "名前" },
    "얼굴": { pos: "名詞", meaning: "顔" },
    "손": { pos: "名詞", meaning: "手" },

    // Emotion & K-POP frequent nouns
    "마음": { pos: "名詞", meaning: "心、気持ち" },
    "맘": { pos: "名詞", meaning: "心、気持ち（마음の縮約）" },
    "사랑": { pos: "名詞", meaning: "愛、恋" },
    "기분": { pos: "名詞", meaning: "気分、気持ち" },
    "느낌": { pos: "名詞", meaning: "感じ、感覚" },
    "생각": { pos: "名詞", meaning: "考え、思い" },
    "기억": { pos: "名詞", meaning: "記憶、思い出" },
    "추억": { pos: "名詞", meaning: "思い出" },
    "꿈": { pos: "名詞", meaning: "夢" },
    "비밀": { pos: "名詞", meaning: "秘密" },
    "약속": { pos: "名詞", meaning: "約束" },
    "고백": { pos: "名詞", meaning: "告白" },
    "이유": { pos: "名詞", meaning: "理由" },
    "거짓말": { pos: "名詞", meaning: "嘘" },
    "눈물": { pos: "名詞", meaning: "涙" },
    "미소": { pos: "名詞", meaning: "微笑み" },
    "웃음": { pos: "名詞", meaning: "笑い、笑顔" },
    "운명": { pos: "名詞", meaning: "運命" },
    "기적": { pos: "名詞", meaning: "奇跡" },
    "우주": { pos: "名詞", meaning: "宇宙" },
    "자석": { pos: "名詞", meaning: "磁石" },
    "이끌림": { pos: "名詞", meaning: "惹かれ合うこと、引力" },
    "진심": { pos: "名詞", meaning: "本心、本気" },
    "말": { pos: "名詞", meaning: "言葉、話" },
    "이야기": { pos: "名詞", meaning: "話、物語" },
    "얘기": { pos: "名詞", meaning: "話（이야기の縮約）" },
    "문": { pos: "名詞", meaning: "扉、ドア" },
    "꽃": { pos: "名詞", meaning: "花" },
    "향기": { pos: "名詞", meaning: "香り" },
    "사진": { pos: "名詞", meaning: "写真" },
    "영상": { pos: "名詞", meaning: "映像、動画" },

    // Adverbs & exclamation & slang
    "정말": { pos: "副詞", meaning: "本当に" },
    "진짜": { pos: "副詞/名詞", meaning: "マジで、本当に" },
    "너무": { pos: "副詞", meaning: "とても、あまりにも" },
    "완전": { pos: "副詞", meaning: "完全に、すごく（口語）" },
    "되게": { pos: "副詞", meaning: "すごく、とても" },
    "엄청": { pos: "副詞", meaning: "めちゃくちゃ、とても" },
    "조금": { pos: "副詞", meaning: "少し" },
    "좀": { pos: "副詞", meaning: "ちょっと（조금の縮約）" },
    "많이": { pos: "副詞", meaning: "たくさん、多く" },
    "더": { pos: "副詞", meaning: "もっと、さらに" },
    "가장": { pos: "副詞", meaning: "最も、一番" },
    "제일": { pos: "副詞", meaning: "一番" },
    "다": { pos: "副詞", meaning: "全部、みんな" },
    "다시": { pos: "副詞", meaning: "また、もう一度" },
    "또": { pos: "副詞", meaning: "また、さらに" },
    "계속": { pos: "副詞", meaning: "ずっと、続けて" },
    "갑자기": { pos: "副詞", meaning: "急に、突然" },
    "자꾸": { pos: "副詞", meaning: "しきりに、何度も" },
    "방금": { pos: "副詞", meaning: "さっき、たった今" },
    "아직": { pos: "副詞", meaning: "まだ" },
    "이미": { pos: "副詞", meaning: "すでに、もう" },
    "벌써": { pos: "副詞", meaning: "もう、すでに" },
    "이제": { pos: "副詞", meaning: "もう、これから" },
    "그냥": { pos: "副詞", meaning: "ただ、なんとなく" },
    "왜": { pos: "副詞", meaning: "なぜ、どうして" },
    "어떻게": { pos: "副詞", meaning: "どうやって、どう" },
    "어떡해": { pos: "縮約表現", meaning: "どうしよう、困った" },
    "뭐": { pos: "代名詞", meaning: "何、えっ（무엇の口語）" },
    "무엇": { pos: "代名詞", meaning: "何" },
    "그래": { pos: "感嘆詞/動詞", meaning: "そう、うん、わかった" },
    "아니": { pos: "感嘆詞", meaning: "いや、違うよ" },
    "대박": { pos: "感嘆詞/名詞", meaning: "すごい、ヤバい（口語）" },
    "헐": { pos: "感嘆詞", meaning: "うそ、マジで（口語）" },
    "아무것도": { pos: "代名詞", meaning: "何も（否定文で）" },
    "아무도": { pos: "代名詞", meaning: "誰も（否定文で）" },

    // Core verbs & adjectives (dictionary stems & lemmas)
    "하다": { pos: "動詞", meaning: "する" },
    "되다": { pos: "動詞", meaning: "なる、できる" },
    "있다": { pos: "存在詞/形容詞", meaning: "ある、いる" },
    "없다": { pos: "存在詞/形容詞", meaning: "ない、いない" },
    "가다": { pos: "動詞", meaning: "行く" },
    "오다": { pos: "動詞", meaning: "来る" },
    "보다": { pos: "動詞", meaning: "見る、会う" },
    "듣다": { pos: "動詞", meaning: "聞く、聴く" },
    "말하다": { pos: "動詞", meaning: "話す、言う" },
    "알다": { pos: "動詞", meaning: "知る、わかる" },
    "모르다": { pos: "動詞", meaning: "知らない、わからない" },
    "좋다": { pos: "形容詞", meaning: "良い" },
    "좋아하다": { pos: "動詞", meaning: "好きだ、気に入る" },
    "싫다": { pos: "形容詞", meaning: "嫌だ" },
    "싫어하다": { pos: "動詞", meaning: "嫌う" },
    "사랑하다": { pos: "動詞", meaning: "愛する" },
    "설레다": { pos: "動詞", meaning: "ときめく、そわそわする" },
    "떨리다": { pos: "動詞", meaning: "緊張する、震える" },
    "예쁘다": { pos: "形容詞", meaning: "きれい、かわいい" },
    "귀엽다": { pos: "形容詞", meaning: "かわいい" },
    "멋있다": { pos: "形容詞", meaning: "かっこいい" },
    "재밌다": { pos: "形容詞", meaning: "面白い（재미있다の縮約）" },
    "재미있다": { pos: "形容詞", meaning: "面白い" },
    "행복하다": { pos: "形容詞", meaning: "幸せだ" },
    "슬프다": { pos: "形容詞", meaning: "悲しい" },
    "아프다": { pos: "形容詞", meaning: "痛い、つらい" },
    "힘들다": { pos: "形容詞", meaning: "大変だ、疲れる" },
    "피곤하다": { pos: "形容詞", meaning: "疲れている" },
    "고맙다": { pos: "形容詞", meaning: "ありがたい、感謝している" },
    "감사하다": { pos: "動詞/形容詞", meaning: "感謝する" },
    "미안하다": { pos: "形容詞", meaning: "ごめん、申し訳ない" },
    "괜찮다": { pos: "形容詞", meaning: "大丈夫だ" },
    "보고싶다": { pos: "形容詞", meaning: "会いたい" },
    "싶다": { pos: "補助形容詞", meaning: "〜したい" },
    "주다": { pos: "動詞", meaning: "あげる、くれる、〜してくれる" },
    "받다": { pos: "動詞", meaning: "もらう、受け取る" },
    "만나다": { pos: "動詞", meaning: "会う" },
    "기다리다": { pos: "動詞", meaning: "待つ" },
    "생각나다": { pos: "動詞", meaning: "思い出す、思い浮かぶ" },
    "기억하다": { pos: "動詞", meaning: "覚えている、記憶する" },
    "잊다": { pos: "動詞", meaning: "忘れる" },
    "웃다": { pos: "動詞", meaning: "笑う" },
    "울다": { pos: "動詞", meaning: "泣く" },
    "노래하다": { pos: "動詞", meaning: "歌う" },
    "부르다": { pos: "動詞", meaning: "歌う、呼ぶ" },
    "추다": { pos: "動詞", meaning: "踊る" },
    "빛나다": { pos: "動詞", meaning: "輝く" },
    "반짝이다": { pos: "動詞", meaning: "きらめく" },
    "끌리다": { pos: "動詞", meaning: "惹かれる" },
    "느끼다": { pos: "動詞", meaning: "感じる" },
    "믿다": { pos: "動詞", meaning: "信じる" },
    "바라다": { pos: "動詞", meaning: "願う、望む" },
    "원하다": { pos: "動詞", meaning: "望む、欲しがる" },
    "필요하다": { pos: "形容詞", meaning: "必要だ" },
    "다르다": { pos: "形容詞", meaning: "違う、異なる" },
    "같다": { pos: "形容詞", meaning: "同じだ、〜のようだ" },
    "많다": { pos: "形容詞", meaning: "多い" },
    "적다": { pos: "形容詞", meaning: "少ない" },
    "크다": { pos: "形容詞", meaning: "大きい" },
    "작다": { pos: "形容詞", meaning: "小さい" },
    "새롭다": { pos: "形容詞", meaning: "新しい" },
    "오래되다": { pos: "形容詞", meaning: "古い、久しい" },
    "빠르다": { pos: "形容詞", meaning: "速い" },
    "느리다": { pos: "形容詞", meaning: "遅い" },
    "쉽다": { pos: "形容詞", meaning: "簡単だ" },
    "어렵다": { pos: "形容詞", meaning: "難しい" },
    "먹다": { pos: "動詞", meaning: "食べる" },
    "마시다": { pos: "動詞", meaning: "飲む" },
    "자다": { pos: "動詞", meaning: "寝る" },
    "일어나다": { pos: "動詞", meaning: "起きる" },
    "앉다": { pos: "動詞", meaning: "座る" },
    "서다": { pos: "動詞", meaning: "立つ" },
    "걷다": { pos: "動詞", meaning: "歩く" },
    "뛰다": { pos: "動詞", meaning: "走る、跳ぶ" },
    "날다": { pos: "動詞", meaning: "飛ぶ" },
    "잡다": { pos: "動詞", meaning: "掴む、握る" },
    "놓다": { pos: "動詞", meaning: "離す、置く" },
    "열다": { pos: "動詞", meaning: "開ける" },
    "닫다": { pos: "動詞", meaning: "閉める" },
    "만들다": { pos: "動詞", meaning: "作る" },
    "배우다": { pos: "動詞", meaning: "学ぶ、習う" },
    "공부하다": { pos: "動詞", meaning: "勉強する" },
    "시작하다": { pos: "動詞", meaning: "始める" },
    "끝나다": { pos: "動詞", meaning: "終わる" },
    "살다": { pos: "動詞", meaning: "生きる、住む" },
    "죽다": { pos: "動詞", meaning: "死ぬ" },
    "숨다": { pos: "動詞", meaning: "隠れる" },
    "찾다": { pos: "動詞", meaning: "探す、見つける" },
    "보내다": { pos: "動詞", meaning: "送る、過ごす" },
    "찍다": { pos: "動詞", meaning: "撮る" },
    "입다": { pos: "動詞", meaning: "着る" },
    "쓰다": { pos: "動詞", meaning: "使う、書く、苦い" },
    "읽다": { pos: "動詞", meaning: "読む" },
    "들어가다": { pos: "動詞", meaning: "入る" },
    "나오다": { pos: "動詞", meaning: "出てくる" },
    "돌아가다": { pos: "動詞", meaning: "戻る、帰る" },
    "안녕하다": { pos: "形容詞", meaning: "元気だ、安らかだ" },
    "진짜로": { pos: "副詞", meaning: "本当に" },
    "이번": { pos: "名詞", meaning: "今回、今度" },
    "다음": { pos: "名詞", meaning: "次" },
    "화이팅": { pos: "感嘆詞", meaning: "ファイト、頑張って" },
    "파이팅": { pos: "感嘆詞", meaning: "ファイト、頑張って" },
    "최고": { pos: "名詞", meaning: "最高" },
    "심쿵": { pos: "名詞/スラング", meaning: "胸キュン" },
    "꿀잼": { pos: "名詞/スラング", meaning: "超面白い（スラング）" },
    "인정": { pos: "名詞", meaning: "認めること、たしかに（口語）" },
    "레전드": { pos: "名詞", meaning: "レジェンド、神回" }
  };

  const PARTICLES = [
    { suffix: "한테서", meaning: "〜から（人）" },
    { suffix: "에게서", meaning: "〜から（人）" },
    { suffix: "한테", meaning: "〜に（口語・人）" },
    { suffix: "에게", meaning: "〜に（人）" },
    { suffix: "처럼", meaning: "〜のように" },
    { suffix: "만큼", meaning: "〜ほど、〜くらい" },
    { suffix: "부터", meaning: "〜から（時間・起点）" },
    { suffix: "까지", meaning: "〜まで" },
    { suffix: "에서", meaning: "〜で、〜から" },
    { suffix: "으로", meaning: "〜へ、〜で（手段・方向）" },
    { suffix: "로", meaning: "〜へ、〜で（手段・方向）" },
    { suffix: "보다", meaning: "〜より" },
    { suffix: "만", meaning: "〜だけ" },
    { suffix: "도", meaning: "〜も" },
    { suffix: "는", meaning: "〜は（主題・母音後）" },
    { suffix: "은", meaning: "〜は（主題・子音後）" },
    { suffix: "가", meaning: "〜が（主語・母音後）" },
    { suffix: "이", meaning: "〜が（主語・子音後）" },
    { suffix: "를", meaning: "〜を（目的語・母音後）" },
    { suffix: "을", meaning: "〜を（目的語・子音後）" },
    { suffix: "에", meaning: "〜に、〜で（場所・時）" },
    { suffix: "의", meaning: "〜の" },
    { suffix: "와", meaning: "〜と（母音後）" },
    { suffix: "과", meaning: "〜と（子音後）" },
    { suffix: "랑", meaning: "〜と（口語・母音後）" },
    { suffix: "이랑", meaning: "〜と（口語・子音後）" },
    { suffix: "엔", meaning: "〜には（에는の縮約）" },
    { suffix: "건", meaning: "〜ことは（것은の縮約）" },
    { suffix: "걸", meaning: "〜ことを（것을の縮約）" }
  ];

  // Ordered longest-first for greedy ending matching
  const ENDINGS = [
    { suffix: "잖아요", label: "-잖아요", meaning: "〜じゃないですか（確認・丁寧）" },
    { suffix: "잖아", label: "-잖아", meaning: "〜じゃん、〜じゃない（確認・口語）" },
    { suffix: "거든요", label: "-거든요", meaning: "〜なんですよ（理由・説明）" },
    { suffix: "거든", label: "-거든", meaning: "〜なんだよ（理由・口語）" },
    { suffix: "고싶어", label: "-고 싶어", meaning: "〜したい" },
    { suffix: "을게요", label: "-(으)ㄹ게요", meaning: "〜しますね（意志・約束）" },
    { suffix: "ㄹ게요", label: "-(으)ㄹ게요", meaning: "〜しますね（意志・約束）" },
    { suffix: "을게", label: "-(으)ㄹ게", meaning: "〜するね（約束・口語）" },
    { suffix: "ㄹ게", label: "-(으)ㄹ게", meaning: "〜するね（約束・口語）" },
    { suffix: "으니까", label: "-(으)니까", meaning: "〜だから（理由）" },
    { suffix: "니까", label: "-(으)니까", meaning: "〜だから（理由）" },
    { suffix: "으면", label: "-(으)면", meaning: "〜すれば、〜なら" },
    { suffix: "면", label: "-(으)면", meaning: "〜すれば、〜なら" },
    { suffix: "었어요", label: "-었어요", meaning: "〜しました（過去・丁寧）" },
    { suffix: "았어요", label: "-았어요", meaning: "〜しました（過去・丁寧）" },
    { suffix: "였어요", label: "-였어요", meaning: "〜しました（過去・丁寧）" },
    { suffix: "었어", label: "-었어", meaning: "〜した（過去・パンマル）" },
    { suffix: "았어", label: "-았어", meaning: "〜した（過去・パンマル）" },
    { suffix: "였어", label: "-였어", meaning: "〜した（過去・パンマル）" },
    { suffix: "고있어", label: "-고 있어", meaning: "〜している（進行）" },
    { suffix: "는데", label: "-는데", meaning: "〜だけど、〜するのに（逆接・前置き）" },
    { suffix: "지만", label: "-지만", meaning: "〜けれど（逆接）" },
    { suffix: "어서", label: "-어서", meaning: "〜して、〜なので" },
    { suffix: "아서", label: "-아서", meaning: "〜해서、〜なので" },
    { suffix: "해서", label: "-해서", meaning: "〜して、〜なので" },
    { suffix: "어요", label: "-어요", meaning: "〜です、〜ます（ヘヨ体）" },
    { suffix: "아요", label: "-아요", meaning: "〜です、〜ます（ヘヨ体）" },
    { suffix: "해요", label: "-해요", meaning: "〜します（ヘヨ体）" },
    { suffix: "해요", label: "-해요", meaning: "〜します" },
    { suffix: "해줘", label: "-해 줘", meaning: "〜して（依頼）" },
    { suffix: "줘", label: "-아/어 줘", meaning: "〜して（依頼）" },
    { suffix: "네요", label: "-네요", meaning: "〜ですね（感嘆・気づき）" },
    { suffix: "네", label: "-네", meaning: "〜だね（感嘆・気づき）" },
    { suffix: "지요", label: "-지요", meaning: "〜ですよね" },
    { suffix: "죠", label: "-죠", meaning: "〜ですよね（지요の縮約）" },
    { suffix: "지", label: "-지", meaning: "〜だよね／〜ない（確認・否定）" },
    { suffix: "고", label: "-고", meaning: "〜して、〜と（並列）" },
    { suffix: "어", label: "-어", meaning: "現在・パンマル（タメ口）" },
    { suffix: "아", label: "-아", meaning: "現在・パンマル（タメ口）" },
    { suffix: "해", label: "-해", meaning: "する（하다のパンマル）" }
  ];

  // Irregular / contracted stems -> base dictionary lemma
  const STEM_NORMALIZATION = {
    "좋아하": "좋아하다",
    "좋아해": "좋아하다",
    "좋아했": "좋아하다",
    "사랑하": "사랑하다",
    "사랑해": "사랑하다",
    "사랑했": "사랑하다",
    "감사하": "감사하다",
    "감사해": "감사하다",
    "공부하": "공부하다",
    "공부해": "공부하다",
    "미안해": "미안하다",
    "행복해": "행복하다",
    "피곤해": "피곤하다",
    "괜찮": "괜찮다",
    "하": "하다",
    "해": "하다",
    "했": "하다",
    "돼": "되다",
    "됐": "되다",
    "예뻐": "예쁘다",
    "예뻤": "예쁘다",
    "아파": "아프다",
    "아팠": "아프다",
    "슬퍼": "슬프다",
    "고마워": "고맙다",
    "귀여워": "귀엽다",
    "어려워": "어렵다",
    "쉬워": "쉽다",
    "몰라": "모르다",
    "알아": "알다",
    "불러": "부르다",
    "걸어": "걷다",
    "들어": "듣다",
    "와": "오다",
    "왔": "오다",
    "가": "가다",
    "갔": "가다",
    "봐": "보다",
    "봤": "보다",
    "줘": "주다",
    "줬": "주다",
    "만나": "만나다",
    "기다려": "기다리다",
    "힘들": "힘들다",
    "힘드": "힘들다",
    "설레": "설레다",
    "있": "있다",
    "없": "없다",
    "같": "같다",
    "웃": "웃다",
    "울": "울다",
    "먹": "먹다",
    "앉": "앉다",
    "읽": "읽다",
    "느껴": "느끼다",
    "믿어": "믿다"
  };

  function cleanHangulWord(raw) {
    return String(raw || "")
      .trim()
      .replace(/^[^\uAC00-\uD7A3A-Za-z0-9]+|[^\uAC00-\uD7A3A-Za-z0-9]+$/g, "");
  }

  function lookupStemToLemma(stem) {
    if (!stem) return null;
    if (BASE_DICT[stem]) return stem;
    if (STEM_NORMALIZATION[stem]) return STEM_NORMALIZATION[stem];
    const withDa = stem + "다";
    if (BASE_DICT[withDa]) return withDa;
    if (stem.endsWith("하") && BASE_DICT[stem + "다"]) return stem + "다";
    return null;
  }

  function analyzeToken(rawWord) {
    const clean = cleanHangulWord(rawWord);
    const phonetics = Hangul ? Hangul.phoneticizeHangul(clean || rawWord) : null;

    if (!clean) {
      return {
        surface: String(rawWord || ""),
        clean: "",
        lemma: "",
        pos: "記号",
        meaning: "",
        endingLabel: "",
        endingMeaning: "",
        phonetics,
        matched: false
      };
    }

    // 1. Exact dictionary match
    if (BASE_DICT[clean]) {
      return {
        surface: String(rawWord || ""),
        clean,
        lemma: clean,
        pos: BASE_DICT[clean].pos,
        meaning: BASE_DICT[clean].meaning,
        endingLabel: "",
        endingMeaning: "",
        phonetics,
        matched: true
      };
    }

    // 2. Contracted/irregular full token direct match
    if (STEM_NORMALIZATION[clean]) {
      const lemma = STEM_NORMALIZATION[clean];
      const entry = BASE_DICT[lemma] || { pos: "用言", meaning: "" };
      return {
        surface: String(rawWord || ""),
        clean,
        lemma,
        pos: entry.pos,
        meaning: entry.meaning,
        endingLabel: "活用形",
        endingMeaning: "現在・パンマル/縮約形",
        phonetics,
        matched: true
      };
    }

    // 3. Particle stripping (Noun + Particle)
    for (const part of PARTICLES) {
      if (clean.length > part.suffix.length && clean.endsWith(part.suffix)) {
        const stem = clean.slice(0, clean.length - part.suffix.length);
        if (BASE_DICT[stem]) {
          return {
            surface: String(rawWord || ""),
            clean,
            lemma: stem,
            pos: `${BASE_DICT[stem].pos} + 助詞`,
            meaning: BASE_DICT[stem].meaning,
            endingLabel: `-${part.suffix}`,
            endingMeaning: part.meaning,
            phonetics,
            matched: true
          };
        }
      }
    }

    // 4. Verbal/Adjectival ending stripping
    for (const end of ENDINGS) {
      if (clean.length > end.suffix.length && clean.endsWith(end.suffix)) {
        const stem = clean.slice(0, clean.length - end.suffix.length);
        const lemma = lookupStemToLemma(stem);
        if (lemma) {
          const entry = BASE_DICT[lemma] || { pos: "用言", meaning: "" };
          return {
            surface: String(rawWord || ""),
            clean,
            lemma,
            pos: `${entry.pos} + 語尾`,
            meaning: entry.meaning,
            endingLabel: end.label,
            endingMeaning: end.meaning,
            phonetics,
            matched: true
          };
        }
      }
    }

    // 5. Fallback guess for unknown words ending in common endings or particles
    for (const end of ENDINGS) {
      if (clean.length > end.suffix.length + 1 && clean.endsWith(end.suffix)) {
        const stem = clean.slice(0, clean.length - end.suffix.length);
        return {
          surface: String(rawWord || ""),
          clean,
          lemma: stem + "다",
          pos: "推定用言",
          meaning: "辞書未登録（ローカルAI解説または手入力で補足可）",
          endingLabel: end.label,
          endingMeaning: end.meaning,
          phonetics,
          matched: false
        };
      }
    }

    return {
      surface: String(rawWord || ""),
      clean,
      lemma: clean,
      pos: "語句",
      meaning: "辞書未登録（単語帳へ保存してメモを追記可）",
      endingLabel: "",
      endingMeaning: "",
      phonetics,
      matched: false
    };
  }

  function computeVocabularyStats(cues, savedCards, vocabLog, options = {}) {
    const map = savedCards || {};
    const vocabWords = (vocabLog && vocabLog.words) || {};
    const vocabVideos = (vocabLog && vocabLog.videos) || {};
    const excludeVid = options && options.excludeVideoId ? String(options.excludeVideoId) : "";
    const excludedCounts = excludeVid && vocabVideos[excludeVid] && vocabVideos[excludeVid].wordCounts
      ? vocabVideos[excludeVid].wordCounts
      : null;

    const seenKeys = new Set();
    let known = 0;
    let learning = 0;
    let seen = 0;
    let unseen = 0;

    for (const cue of Array.isArray(cues) ? cues : []) {
      const words = String(cue.ko || cue.text || "").split(/\s+/);
      for (const raw of words) {
        const clean = cleanHangulWord(raw);
        if (!clean || !/[\uAC00-\uD7A3]/.test(clean)) continue;
        const parsed = analyzeToken(clean);
        const logKey = parsed.matched && parsed.lemma ? parsed.lemma : clean;
        const lemmaKey = parsed.lemma || clean;
        const dedupKey = logKey;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);

        const card = map[clean] || map[lemmaKey] || map[logKey];
        if (card && card.mastered) {
          known++;
        } else if (card) {
          learning++;
        } else {
          const entry = vocabWords[logKey] || vocabWords[lemmaKey] || vocabWords[clean];
          if (entry) {
            const fromExcluded = Boolean(excludedCounts && excludedCounts[entry.key]);
            const priorVideos = (Number(entry.videoCount) || 0) - (fromExcluded ? 1 : 0);
            if (priorVideos >= 1) seen++;
            else unseen++;
          } else {
            unseen++;
          }
        }
      }
    }

    const total = known + learning + seen + unseen;
    if (total === 0) {
      return { total: 0, known: 0, learning: 0, seen: 0, unseen: 0, knownPct: 0, learningPct: 0, seenPct: 0, unseenPct: 0 };
    }
    const counts = [known, learning, seen, unseen];
    const exact = counts.map((c) => (c / total) * 100);
    const floors = exact.map((v) => Math.floor(v));
    let rem = 100 - floors.reduce((a, b) => a + b, 0);
    const order = exact
      .map((v, i) => ({ i, frac: v - floors[i] }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < rem; k++) {
      floors[order[k % order.length].i] += 1;
    }
    return {
      total,
      known,
      learning,
      seen,
      unseen,
      knownPct: floors[0],
      learningPct: floors[1],
      seenPct: floors[2],
      unseenPct: floors[3]
    };
  }

  const STARTER_WORDS = [
    { surface: "설레잖아", context: "내 맘이 너한테 설레잖아", jaContext: "私の心が君にときめくじゃない", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 42 },
    { surface: "좋아해", context: "이번엔 정말 좋아해", jaContext: "今度は本当に好きだよ", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 38 },
    { surface: "같이", context: "우리 같이 있으면 어떡해", jaContext: "私たちが一緒にいたらどうしよう", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 47 },
    { surface: "어떡해", context: "우리 같이 있으면 어떡해", jaContext: "私たちが一緒にいたらどうしよう", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 48 },
    { surface: "힘들었어", context: "오늘 연습 진짜 힘들었어", jaContext: "今日の練習、本当に大変だった", sourceTitle: "VLOG・会話スターター", sourceUrl: "", timestampSec: 75 },
    { surface: "진짜", context: "이 노래 진짜 좋다", jaContext: "この曲ほんとに良いね", sourceTitle: "VLOG・会話スターター", sourceUrl: "", timestampSec: 12 },
    { surface: "보고싶어", context: "빨리 만나고 보고싶어", jaContext: "早く会いたいよ", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 65 },
    { surface: "기다려", context: "여기서 계속 기다려", jaContext: "ここでずっと待っているよ", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 81 },
    { surface: "약속", context: "우리만의 작은 약속", jaContext: "私たちだけの小さな約束", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 94 },
    { surface: "마음", context: "내 마음을 보여줄게", jaContext: "私の気持ちを見せるね", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 55 },
    { surface: "순간", context: "이 순간을 기억해", jaContext: "この瞬間を覚えていて", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 108 },
    { surface: "빛나다", context: "밤하늘 별처럼 빛나다", jaContext: "夜空の星のように輝く", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 120 },
    { surface: "고마워", context: "항상 응원해줘서 고마워", jaContext: "いつも応援してくれてありがとう", sourceTitle: "VLOG・会話スターター", sourceUrl: "", timestampSec: 33 },
    { surface: "괜찮아", context: "실수해도 다 괜찮아", jaContext: "失敗しても全部大丈夫だよ", sourceTitle: "VLOG・会話スターター", sourceUrl: "", timestampSec: 40 },
    { surface: "예뻐", context: "오늘 무대 너무 예뻐", jaContext: "今日のステージすごくきれい", sourceTitle: "VLOG・会話スターター", sourceUrl: "", timestampSec: 25 },
    { surface: "귀여워", context: "표정이 진짜 귀여워", jaContext: "表情が本当に可愛い", sourceTitle: "VLOG・会話スターター", sourceUrl: "", timestampSec: 18 },
    { surface: "연습", context: "오늘도 늦게까지 연습", jaContext: "今日も遅くまで練習", sourceTitle: "VLOG・会話スターター", sourceUrl: "", timestampSec: 50 },
    { surface: "목소리", context: "너의 목소리가 들려", jaContext: "君の声が聞こえる", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 70 },
    { surface: "거짓말", context: "그건 다 거짓말이야", jaContext: "それは全部嘘だよ", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 90 },
    { surface: "눈물", context: "눈물이 자꾸 나네", jaContext: "涙がしきりに出るね", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 112 },
    { surface: "이끌림", context: "운명 같은 끌림과 이끌림", jaContext: "運命のような引力と惹かれ合い", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 28 },
    { surface: "대박", context: "이 안무 완전 대박", jaContext: "この振り付けマジですごい", sourceTitle: "VLOG・会話スターター", sourceUrl: "", timestampSec: 60 },
    { surface: "심쿵", context: "그 표정에 심쿵했어", jaContext: "その表情に胸キュンした", sourceTitle: "VLOG・会話スターター", sourceUrl: "", timestampSec: 84 },
    { surface: "다시", context: "처음부터 다시 시작해", jaContext: "最初からもう一度始めよう", sourceTitle: "K-POP スターター表現", sourceUrl: "", timestampSec: 102 }
  ];

  function buildStarterDeck() {
    return STARTER_WORDS.map((item) => {
      const a = analyzeToken(item.surface);
      const p = a.phonetics;
      return {
        id: `starter-${a.clean}`,
        surface: a.clean,
        lemma: a.lemma || a.clean,
        pos: a.pos,
        meaning: a.meaning,
        endingLabel: a.endingLabel,
        endingMeaning: a.endingMeaning,
        pronouncedHangul: p ? p.pronouncedHangul : a.clean,
        katakana: p ? p.katakana : "",
        romanized: p ? p.romanized : "",
        appliedRules: p ? p.appliedRules : [],
        context: item.context,
        jaContext: item.jaContext,
        sourceTitle: item.sourceTitle,
        sourceUrl: item.sourceUrl,
        timestampSec: item.timestampSec,
        reps: 0,
        intervalDays: 0,
        ease: 2.5,
        lapses: 0,
        streak: 0,
        mastered: false,
        dueAt: 0
      };
    });
  }

  return {
    BASE_DICT,
    cleanHangulWord,
    analyzeToken,
    computeVocabularyStats,
    buildStarterDeck
  };
});
