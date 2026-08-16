/**
 * Two example sentences per flavor, per language, for the Daily Challenge
 * feature. These are concrete instances of what the flavor's real-world
 * activity sounds like in the target language — shown inline in the
 * overlay so the user has a running-start model sentence, not just an
 * English instruction.
 *
 * Structure: EXAMPLES[typeId][flavorId] = { en: [s1,s2], de: [...], ... }
 * flavorId must match the `id` field in FLAVORS in dailyChallenge.js exactly.
 */

export const EXAMPLES = {
  naming: {
    'naming-desk': {
      en: ['This is a pen.', 'This is a notebook.'],
      de: ['Das ist ein Stift.', 'Das ist ein Heft.'],
      es: ['Esto es un bolígrafo.', 'Esto es un cuaderno.'],
      fr: ['C\u2019est un stylo.', 'C\u2019est un cahier.'],
      ja: ['これはペンです。', 'これはノートです。'],
      zh: ['这是一支笔。', '这是一个本子。'],
    },
    'naming-vehicle': {
      en: ['That is a car.', 'That is a bicycle.'],
      de: ['Das ist ein Auto.', 'Das ist ein Fahrrad.'],
      es: ['Eso es un coche.', 'Eso es una bicicleta.'],
      fr: ['C\u2019est une voiture.', 'C\u2019est un vélo.'],
      ja: ['あれは車です。', 'あれは自転車です。'],
      zh: ['那是一辆车。', '那是一辆自行车。'],
    },
    'naming-food': {
      en: ['This is coffee.', 'This is bread.'],
      de: ['Das ist Kaffee.', 'Das ist Brot.'],
      es: ['Esto es café.', 'Esto es pan.'],
      fr: ['C\u2019est du café.', 'C\u2019est du pain.'],
      ja: ['これはコーヒーです。', 'これはパンです。'],
      zh: ['这是咖啡。', '这是面包。'],
    },
    'naming-room': {
      en: ['This is a chair.', 'This is a lamp.'],
      de: ['Das ist ein Stuhl.', 'Das ist eine Lampe.'],
      es: ['Esto es una silla.', 'Esto es una lámpara.'],
      fr: ['C\u2019est une chaise.', 'C\u2019est une lampe.'],
      ja: ['これは椅子です。', 'これはランプです。'],
      zh: ['这是一把椅子。', '这是一盏灯。'],
    },
  },
  constraint: {
    'constraint-red': {
      en: ['The apple is red.', 'My cup is red.'],
      de: ['Der Apfel ist rot.', 'Meine Tasse ist rot.'],
      es: ['La manzana es roja.', 'Mi taza es roja.'],
      fr: ['La pomme est rouge.', 'Ma tasse est rouge.'],
      ja: ['リンゴは赤いです。', '私のカップは赤いです。'],
      zh: ['苹果是红色的。', '我的杯子是红色的。'],
    },
    'constraint-kitchen': {
      en: ['The pot is on the stove.', 'The knife is on the table.'],
      de: ['Der Topf steht auf dem Herd.', 'Das Messer liegt auf dem Tisch.'],
      es: ['La olla está en la estufa.', 'El cuchillo está en la mesa.'],
      fr: ['La casserole est sur la cuisinière.', 'Le couteau est sur la table.'],
      ja: ['鍋はコンロの上にあります。', 'ナイフはテーブルの上にあります。'],
      zh: ['锅在炉子上。', '刀在桌子上。'],
    },
    'constraint-metal': {
      en: ['The fork is metal.', 'The key is metal.'],
      de: ['Die Gabel ist aus Metall.', 'Der Schlüssel ist aus Metall.'],
      es: ['El tenedor es de metal.', 'La llave es de metal.'],
      fr: ['La fourchette est en métal.', 'La clé est en métal.'],
      ja: ['フォークは金属です。', '鍵は金属です。'],
      zh: ['叉子是金属的。', '钥匙是金属的。'],
    },
    'constraint-onehand': {
      en: ['This is a phone.', 'This is a cup.'],
      de: ['Das ist ein Handy.', 'Das ist eine Tasse.'],
      es: ['Esto es un teléfono.', 'Esto es una taza.'],
      fr: ['C\u2019est un téléphone.', 'C\u2019est une tasse.'],
      ja: ['これは携帯電話です。', 'これはカップです。'],
      zh: ['这是一部手机。', '这是一个杯子。'],
    },
    'constraint-clothing': {
      en: ['She is wearing a jacket.', 'He is wearing shoes.'],
      de: ['Sie trägt eine Jacke.', 'Er trägt Schuhe.'],
      es: ['Ella lleva una chaqueta.', 'Él lleva zapatos.'],
      fr: ['Elle porte une veste.', 'Il porte des chaussures.'],
      ja: ['彼女はジャケットを着ています。', '彼は靴を履いています。'],
      zh: ['她穿着一件夹克。', '他穿着鞋子。'],
    },
  },
  narrating: {
    'narrating-morning': {
      en: ['I brush my teeth.', 'I get dressed.'],
      de: ['Ich putze mir die Zähne.', 'Ich ziehe mich an.'],
      es: ['Me cepillo los dientes.', 'Me visto.'],
      fr: ['Je me brosse les dents.', 'Je m\u2019habille.'],
      ja: ['歯を磨きます。', '服を着ます。'],
      zh: ['我刷牙。', '我穿衣服。'],
    },
    'narrating-meal': {
      en: ['I boil the water.', 'I cut the vegetables.'],
      de: ['Ich koche das Wasser.', 'Ich schneide das Gemüse.'],
      es: ['Hiervo el agua.', 'Corto las verduras.'],
      fr: ['Je fais bouillir l\u2019eau.', 'Je coupe les légumes.'],
      ja: ['お湯を沸かします。', '野菜を切ります。'],
      zh: ['我烧水。', '我切蔬菜。'],
    },
    'narrating-commute': {
      en: ['I open the door.', 'I walk to the station.'],
      de: ['Ich öffne die Tür.', 'Ich gehe zum Bahnhof.'],
      es: ['Abro la puerta.', 'Camino hacia la estación.'],
      fr: ['J\u2019ouvre la porte.', 'Je marche jusqu\u2019à la gare.'],
      ja: ['ドアを開けます。', '駅まで歩きます。'],
      zh: ['我打开门。', '我走去车站。'],
    },
    'narrating-chore': {
      en: ['I wash the dishes.', 'I make the bed.'],
      de: ['Ich spüle das Geschirr.', 'Ich mache das Bett.'],
      es: ['Lavo los platos.', 'Hago la cama.'],
      fr: ['Je fais la vaisselle.', 'Je fais le lit.'],
      ja: ['食器を洗います。', 'ベッドを整えます。'],
      zh: ['我洗碗。', '我整理床铺。'],
    },
  },
  recap: {
    'recap-break': {
      en: ['This morning I answered emails.', 'Then I had a meeting.'],
      de: ['Heute Morgen habe ich E-Mails beantwortet.', 'Dann hatte ich eine Besprechung.'],
      es: ['Esta mañana respondí correos.', 'Luego tuve una reunión.'],
      fr: ['Ce matin, j\u2019ai répondu à des e-mails.', 'Ensuite, j\u2019ai eu une réunion.'],
      ja: ['今朝、メールに返信しました。', 'それから会議がありました。'],
      zh: ['今天早上我回复了邮件。', '然后我开了一个会。'],
    },
    'recap-lunch': {
      en: ['So far today, I finished a report.', 'Now it\u2019s time for lunch.'],
      de: ['Bisher habe ich heute einen Bericht fertiggestellt.', 'Jetzt ist Mittagszeit.'],
      es: ['Hasta ahora hoy, terminé un informe.', 'Ahora es hora de comer.'],
      fr: ['Jusqu\u2019à présent aujourd\u2019hui, j\u2019ai terminé un rapport.', 'Maintenant c\u2019est l\u2019heure du déjeuner.'],
      ja: ['今日はここまでにレポートを終えました。', '今はお昼の時間です。'],
      zh: ['今天到目前为止我完成了一份报告。', '现在是午饭时间。'],
    },
    'recap-tomorrow': {
      en: ['Tomorrow I will call a client.', 'Tomorrow I will finish the project.'],
      de: ['Morgen rufe ich einen Kunden an.', 'Morgen beende ich das Projekt.'],
      es: ['Mañana llamaré a un cliente.', 'Mañana terminaré el proyecto.'],
      fr: ['Demain, j\u2019appellerai un client.', 'Demain, je terminerai le projet.'],
      ja: ['明日、お客様に電話します。', '明日、プロジェクトを終えます。'],
      zh: ['明天我会给客户打电话。', '明天我会完成这个项目。'],
    },
  },
  signs: {
    'signs-street': {
      en: ['Stop.', 'No parking.'],
      de: ['Halt.', 'Parken verboten.'],
      es: ['Alto.', 'Prohibido aparcar.'],
      fr: ['Stop.', 'Stationnement interdit.'],
      ja: ['止まれ。', '駐車禁止。'],
      zh: ['停。', '禁止停车。'],
    },
    'signs-elevator': {
      en: ['Out of service.', 'Maximum eight people.'],
      de: ['Außer Betrieb.', 'Maximal acht Personen.'],
      es: ['Fuera de servicio.', 'Máximo ocho personas.'],
      fr: ['Hors service.', 'Maximum huit personnes.'],
      ja: ['故障中。', '定員8名。'],
      zh: ['故障停用。', '限乘八人。'],
    },
    'signs-safety': {
      en: ['Emergency exit.', 'Wear a helmet.'],
      de: ['Notausgang.', 'Helm tragen.'],
      es: ['Salida de emergencia.', 'Use casco.'],
      fr: ['Sortie de secours.', 'Port du casque obligatoire.'],
      ja: ['非常口。', 'ヘルメット着用。'],
      zh: ['紧急出口。', '请戴安全帽。'],
    },
    'signs-shop': {
      en: ['Open today.', 'Closed on Mondays.'],
      de: ['Heute geöffnet.', 'Montags geschlossen.'],
      es: ['Abierto hoy.', 'Cerrado los lunes.'],
      fr: ['Ouvert aujourd\u2019hui.', 'Fermé le lundi.'],
      ja: ['本日営業中。', '月曜定休。'],
      zh: ['今日营业。', '周一休息。'],
    },
    'signs-menu': {
      en: ['Grilled chicken.', 'Vegetable soup.'],
      de: ['Gegrilltes Hähnchen.', 'Gemüsesuppe.'],
      es: ['Pollo a la parrilla.', 'Sopa de verduras.'],
      fr: ['Poulet grillé.', 'Soupe de légumes.'],
      ja: ['グリルチキン。', '野菜スープ。'],
      zh: ['烤鸡。', '蔬菜汤。'],
    },
  },
  postit: {
    'postit-household': {
      en: ['This is the door.', 'This is the window.'],
      de: ['Das ist die Tür.', 'Das ist das Fenster.'],
      es: ['Esto es la puerta.', 'Esto es la ventana.'],
      fr: ['C\u2019est la porte.', 'C\u2019est la fenêtre.'],
      ja: ['これはドアです。', 'これは窓です。'],
      zh: ['这是门。', '这是窗户。'],
    },
    'postit-room': {
      en: ['This is the sink.', 'This is the mirror.'],
      de: ['Das ist das Waschbecken.', 'Das ist der Spiegel.'],
      es: ['Esto es el lavabo.', 'Esto es el espejo.'],
      fr: ['C\u2019est le lavabo.', 'C\u2019est le miroir.'],
      ja: ['これは洗面台です。', 'これは鏡です。'],
      zh: ['这是洗手池。', '这是镜子。'],
    },
    'postit-fridge': {
      en: ['This is milk.', 'This is rice.'],
      de: ['Das ist Milch.', 'Das ist Reis.'],
      es: ['Esto es leche.', 'Esto es arroz.'],
      fr: ['C\u2019est du lait.', 'C\u2019est du riz.'],
      ja: ['これは牛乳です。', 'これは米です。'],
      zh: ['这是牛奶。', '这是米。'],
    },
    'postit-desk': {
      en: ['This is a computer.', 'This is a lamp.'],
      de: ['Das ist ein Computer.', 'Das ist eine Lampe.'],
      es: ['Esto es una computadora.', 'Esto es una lámpara.'],
      fr: ['C\u2019est un ordinateur.', 'C\u2019est une lampe.'],
      ja: ['これはパソコンです。', 'これはランプです。'],
      zh: ['这是电脑。', '这是台灯。'],
    },
  },
  'describe-day': {
    'describe-day-whole': {
      en: ['Today was busy.', 'I met a friend in the evening.'],
      de: ['Heute war es stressig.', 'Am Abend habe ich einen Freund getroffen.'],
      es: ['Hoy estuvo ocupado.', 'Por la noche vi a un amigo.'],
      fr: ['Aujourd\u2019hui a été chargé.', 'Le soir, j\u2019ai vu un ami.'],
      ja: ['今日は忙しかったです。', '夜、友達に会いました。'],
      zh: ['今天很忙。', '晚上我见了一个朋友。'],
    },
    'describe-day-voicemsg': {
      en: ['Hey, my day was good.', 'I\u2019ll call you later.'],
      de: ['Hey, mein Tag war gut.', 'Ich rufe dich später an.'],
      es: ['Oye, mi día estuvo bien.', 'Te llamo más tarde.'],
      fr: ['Salut, ma journée a été bonne.', 'Je t\u2019appelle plus tard.'],
      ja: ['今日は良い一日だったよ。', '後で電話するね。'],
      zh: ['嘿，我今天过得不错。', '我晚点给你打电话。'],
    },
    'describe-day-bestworst': {
      en: ['The best part was lunch.', 'The worst part was the traffic.'],
      de: ['Der beste Teil war das Mittagessen.', 'Der schlimmste Teil war der Verkehr.'],
      es: ['Lo mejor fue el almuerzo.', 'Lo peor fue el tráfico.'],
      fr: ['Le meilleur moment était le déjeuner.', 'Le pire moment était les embouteillages.'],
      ja: ['一番良かったのはお昼ご飯です。', '一番大変だったのは渋滞でした。'],
      zh: ['最好的部分是午饭。', '最糟糕的部分是堵车。'],
    },
    'describe-day-tomorrow': {
      en: ['Today I worked a lot.', 'Tomorrow I will rest.'],
      de: ['Heute habe ich viel gearbeitet.', 'Morgen werde ich mich ausruhen.'],
      es: ['Hoy trabajé mucho.', 'Mañana descansaré.'],
      fr: ['Aujourd\u2019hui, j\u2019ai beaucoup travaillé.', 'Demain, je me reposerai.'],
      ja: ['今日はたくさん働きました。', '明日は休みます。'],
      zh: ['今天我工作了很多。', '明天我要休息。'],
    },
  },
}

/** Get the two example sentences for a type/flavor/language, falling back to English if missing. */
export function getExamples(typeId, flavorId, lang) {
  const set = EXAMPLES[typeId]?.[flavorId]
  if (!set) return []
  return set[lang] ?? set.en ?? []
}
