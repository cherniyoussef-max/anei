/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const htmlContent = `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>Référentiel Complet : Trouble du Spectre de l'Autisme (TSA) & Accompagnement Scolaire Inclusif — ANEI</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 9pt;
        color: #64748b;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      font-size: 10.5pt;
      background: #ffffff;
    }

    .arabic-text {
      font-family: 'IBM Plex Sans Arabic', sans-serif;
      direction: rtl;
      text-align: right;
      line-height: 1.8;
    }

    .cover-page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 92vh;
      border: 3px solid #0A192F;
      padding: 40px;
      position: relative;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    }

    .cover-page::before {
      content: "";
      position: absolute;
      top: 10px; left: 10px; right: 10px; bottom: 10px;
      border: 1px solid #C5A059;
      pointer-events: none;
    }

    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0A192F;
      padding-bottom: 20px;
    }

    .cover-logo-text {
      font-weight: 800;
      color: #0A192F;
      font-size: 16pt;
      letter-spacing: -0.5px;
    }

    .cover-logo-sub {
      font-size: 9pt;
      color: #C5A059;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    .cover-title-group {
      margin: auto 0;
      text-align: center;
      padding: 30px 10px;
    }

    .cover-tag {
      display: inline-block;
      background: #0A192F;
      color: #C5A059;
      font-size: 9pt;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 24px;
    }

    .cover-title-ar {
      font-family: 'IBM Plex Sans Arabic', sans-serif;
      font-size: 24pt;
      font-weight: 700;
      color: #0A192F;
      line-height: 1.4;
      margin-bottom: 20px;
      direction: rtl;
    }

    .cover-title-fr {
      font-size: 18pt;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.35;
      margin-bottom: 16px;
    }

    .cover-desc {
      font-size: 11pt;
      color: #475569;
      max-width: 650px;
      margin: 0 auto;
      line-height: 1.6;
    }

    .cover-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 9.5pt;
      color: #64748b;
    }

    .chapter-divider {
      page-break-before: always;
      margin-top: 20px;
      padding: 24px;
      background: #0A192F;
      color: #ffffff;
      border-radius: 8px;
      margin-bottom: 30px;
    }

    .chapter-number {
      font-size: 11pt;
      font-weight: 700;
      color: #C5A059;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 6px;
    }

    .chapter-title-fr {
      font-size: 16pt;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .chapter-title-ar {
      font-family: 'IBM Plex Sans Arabic', sans-serif;
      font-size: 16pt;
      font-weight: 600;
      direction: rtl;
      text-align: right;
      color: #e2e8f0;
    }

    h2 {
      font-size: 13pt;
      color: #0A192F;
      margin-top: 24px;
      margin-bottom: 12px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
    }

    h3 {
      font-size: 11pt;
      color: #1e3a8a;
      margin-top: 16px;
      margin-bottom: 8px;
    }

    p {
      margin-bottom: 12px;
      text-align: justify;
    }

    .bilingual-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 16px 0;
      padding: 14px;
      background: #f8fafc;
      border-left: 4px solid #C5A059;
      border-radius: 4px;
      page-break-inside: avoid;
    }

    .bilingual-block.ar-first {
      direction: rtl;
    }

    .card-box {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
      page-break-inside: avoid;
    }

    .card-box-accent {
      border-left: 4px solid #0056D2;
      background: #f0f7ff;
    }

    .card-box-gold {
      border-left: 4px solid #C5A059;
      background: #fffcf5;
    }

    ul, ol {
      margin-left: 20px;
      margin-bottom: 14px;
    }

    li {
      margin-bottom: 6px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }

    th {
      background: #0A192F;
      color: #ffffff;
      font-weight: 600;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    .checklist-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
      page-break-inside: avoid;
    }

    .check-box {
      width: 14px;
      height: 14px;
      border: 1.5px solid #0A192F;
      border-radius: 3px;
      margin-top: 3px;
      flex-shrink: 0;
    }

    .callout-warning {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-left: 4px solid #ea580c;
      padding: 12px 16px;
      border-radius: 4px;
      margin: 14px 0;
      font-size: 9.5pt;
    }
  </style>
</head>
<body>

  <!-- ==================== PAGE DE GARDE ==================== -->
  <div class="cover-page">
    <div class="cover-header">
      <div>
        <div class="cover-logo-text">ANEI</div>
        <div class="cover-logo-sub">Académie Nationale de l'Éducation Inclusive</div>
      </div>
      <div class="arabic-text" style="font-size: 13pt; font-weight: 700; color: #0A192F;">
        الأكاديمية الوطنية للتربية الدامجة
      </div>
    </div>

    <div class="cover-title-group">
      <div class="cover-tag">RÉFÉRENTIEL SCIENTIFIQUE & GUIDE PROFESSIONNEL · الدليل المهني الرسمي</div>
      <div class="cover-title-ar">
        اضطراب طيف التوحّد: الفهم العلمي، المرافقة المدرسية والممارسات التربوية المبنية على البراهين
      </div>
      <div class="cover-title-fr">
        Trouble du Spectre de l'Autisme (TSA) : Compréhension Clinique, Accompagnement Scolaire Inclusif & Pratiques Fondées sur les Preuves (EBP)
      </div>
      <p class="cover-desc">
        Un guide complet de 3 grands chapitres destiné aux enseignants, accompagnants scolaires (AVS), spécialistes et familles. Définitions cliniques DSM-5, aménagement spatio-temporel de la classe, outils visuels, gestion fonctionnelle des comportements défis (Modèle ABC) et fiches d'action concrètes.
      </p>
    </div>

    <div class="cover-footer">
      <div>
        <strong>Édition Officielle 2026</strong> · ANEI Publications
        <br>
        Document de référence pour la certification professionnelle AVS & Enseignant Inclusif
      </div>
      <div class="arabic-text" style="font-size: 9pt;">
        الجمهورية التونسية · المنصة الوطنية للتربية الدامجة
      </div>
    </div>
  </div>

  <!-- ==================== SOMMAIRE ==================== -->
  <div style="page-break-after: always; padding: 20px 0;">
    <h2>Table des Matières / الفهرس العام</h2>
    <div style="margin-top: 20px; line-height: 2;">
      <p><strong>Chapitre 1 / الفصل الأول :</strong> Fondements cliniques et compréhension du Trouble du Spectre de l'Autisme (Sections 1 à 29) ........................................ 3</p>
      <p><strong>Chapitre 2 / الفصل الثاني :</strong> Accompagner l'élève avec TSA en milieu scolaire : Guide pratique AVS & Enseignant (Sections 1 à 30) ............................ 12</p>
      <p><strong>Étude de cas clinique & Analyse ABC :</strong> L'élève de 8 ans et le refus de tâche d'écriture ............................................................................................ 20</p>
      <p><strong>Checklist pratique :</strong> Les 14 questions clés de l'enseignant et de l'AVS avant toute activité ................................................................................. 22</p>
      <p><strong>Chapitre 3 / الفصل الثالث :</strong> Les Pratiques Éducatives Fondées sur les Preuves (EBP) dans l'accompagnement du TSA (Sections 1 à 30) ............................. 24</p>
      <p><strong>Matrice de décision EBP :</strong> Tableau de correspondance Besoin ➔ Objectif ➔ Pratique EBP ➔ Indicateur mesurable ................................................... 32</p>
    </div>
  </div>

  <!-- ==================== CHAPITRE 1 ==================== -->
  <div class="chapter-divider">
    <div class="chapter-number">Chapitre 1 / الفصل الأول</div>
    <div class="chapter-title-fr">Fondements Cliniques & Compréhension du Trouble du Spectre de l'Autisme (TSA)</div>
    <div class="chapter-title-ar">اضطراب طيف التوحّد: الفهم العلمي، التاريخ والخصائص النمائية</div>
  </div>

  <h2>1. Introduction & Définition Générale (مقدمة وتعريف)</h2>
  <div class="bilingual-block">
    <div>
      <p><strong>Perspective Francophone :</strong></p>
      <p>Le Trouble du Spectre de l'Autisme (TSA) est un trouble neurodéveloppemental d'apparition précoce qui affecte à des degrés variables la communication, les interactions sociales ainsi que les comportements, intérêts et activités. On parle de « spectre » car les manifestations et l'intensité du soutien nécessaire diffèrent considérablement d'un enfant à l'autre : certains développent un langage riche et une grande autonomie cognitive, tandis que d'autres requièrent un étayage continu et intensif au quotidien.</p>
    </div>
    <div class="arabic-text">
      <p><strong>النص العربي المرجعي :</strong></p>
      <p>يُعدّ اضطراب طيف التوحّد من الاضطرابات النمائية العصبية التي تبدأ خلال مراحل الطفولة المبكرة، وتؤثر بدرجات متفاوتة في التواصل والتفاعل الاجتماعي، وفي أنماط السلوك والاهتمامات والأنشطة. ويُسمّى «طيفًا» لأن مظاهره ودرجات تأثيره تختلف بشكل كبير من طفل إلى آخر؛ فقد يكون بعض الأطفال قادرين على استخدام اللغة والتعلم والاستقلالية بدرجات جيدة، في حين يحتاج آخرون إلى دعم مكثف ومستمر في مجالات متعددة من حياتهم.</p>
    </div>
  </div>

  <h2>2. Évolution Scientifique & Notion de « Spectre » (تطور المفهوم العلمي)</h2>
  <p>L'histoire de la pédopsychiatrie contemporaine retient les travaux fondateurs de <strong>Leo Kanner (1943)</strong>, qui décrivit l'autisme précoce chez l'enfant, et ceux de <strong>Hans Asperger</strong>. Au fil des classifications (notamment avec le passage du DSM-IV au DSM-5), la médecine a abandonné les catégories rigides (autisme infantile, syndrome d'Asperger, trouble envahissant du développement non spécifié) au profit d'une entité unifiée : le <em>Trouble du Spectre de l'Autisme</em> (TSA), gradué selon le niveau de soutien requis (Niveaux 1, 2 et 3).</p>

  <div class="arabic-text card-box">
    <strong>تطور الفهم العلمي :</strong>
    بدأ الاهتمام العلمي الحديث بالتوحّد مع أعمال ليو كانر سنة 1943 وهانز أسبرجر. وقد جمع التصنيف الحديث في الدليل التشخيصي والإحصائي الخامس (DSM-5) هذه الحالات ضمن مفهوم أوسع هو "اضطراب طيف التوحّد"، مما يعكس حقيقة أن الأفراد لا يقدمون الصورة ذاتها من الأعراض ولا يحتاجون نفس الدرجة من الدعم.
  </div>

  <h2>3. Les Deux Grands Domaines Dyadiques (DSM-5)</h2>
  <div class="card-box card-box-accent">
    <h3>Domaine A : Déficits persistants de la communication et des interactions sociales</h3>
    <ul>
      <li>Difficultés de réciprocité socio-émotionnelle (initier ou répondre aux échanges, partage des intérêts et émotions).</li>
      <li>Déficits des comportements de communication non verbale (contact visuel modulé, posture, gestes, expressions faciales).</li>
      <li>Difficultés à développer, maintenir et comprendre les relations entre pairs et les règles sociales implicites.</li>
    </ul>
    <h3>Domaine B : Caractère restreint et répétitif des comportements, intérêts ou activités</h3>
    <ul>
      <li>Stéréotypies motrices, utilisation répétitive des objets ou écholalies (répétition de mots/phrases).</li>
      <li>Intolérance au changement, adhésion inflexible à des routines ou rituels non fonctionnels.</li>
      <li>Intérêts restreints hautement focalisés et spécifiques.</li>
      <li>Hyper- ou hypo-réactivité sensorielle aux stimulations de l'environnement (bruits, lumières, textures, odeurs).</li>
    </ul>
  </div>

  <h2>4. L'Attention Conjointe : Clé de Voûte du Développement (الانتباه المشترك)</h2>
  <p>L'<strong>attention conjointe</strong> désigne la capacité de l'enfant à coordonner son attention avec celle d'une autre personne vers un objet ou événement tiers (ex. pointer du doigt pour montrer un jouet, vérifier du regard que l'adulte regarde la même chose). C'est le précurseur indispensable à l'émergence du langage, de l'empathie cognitive (théorie de l'esprit) et de l'apprentissage social.</p>

  <div class="callout-warning">
    <strong>Point d'attention scientifique :</strong> Les comportements répétitifs et l'attachement à la routine ne doivent jamais être interprétés comme de l'entêtement (« عناد »). Ils constituent souvent le principal mécanisme d'autorégulation de l'enfant pour atténuer l'angoisse face à un environnement perçu comme imprévisible et surstimulant.
  </div>

  <h2>5. Vérité Scientifique sur les Causes & Dépistage Précoce</h2>
  <p>Les données génétiques et neurobiologiques confirment une étiologie multifactorielle complexe combinant vulnérabilité génétique et facteurs environnementaux précoces. <strong>Les études scientifiques internationales ont rigoureusement réfuté le mythe liant l'autisme aux vaccins.</strong> De même, la théorie culpabilisante des « mères froides » est définitivement caduque.</p>
  <p>Le dépistage précoce (via des outils comme le M-CHAT) ne constitue pas un diagnostic définitif, mais une alerte permettant d'amorcer sans délai un accompagnement précoce qui optimise la plasticité cérébrale de l'enfant.</p>

  <!-- ==================== CHAPITRE 2 ==================== -->
  <div class="chapter-divider">
    <div class="chapter-number">Chapitre 2 / الفصل الثاني</div>
    <div class="chapter-title-fr">Accompagner l'Élève avec TSA à l'École : Guide Pratique AVS & Enseignant</div>
    <div class="chapter-title-ar">مرافقة التلميذ ذي اضطراب طيف التوحّد في الوسط المدرسي</div>
  </div>

  <h2>1. Du Diagnostic au Profil Pédagogique Individuel</h2>
  <p>Accompagner un élève autiste ne se résume pas à s'asseoir à côté de lui pour faire le travail à sa place. Le rôle fondamental de l'AVS et de l'enseignant est de <strong>construire son autonomie</strong> en adaptant l'environnement et en supprimant les obstacles à l'apprentissage.</p>

  <div class="bilingual-block">
    <div>
      <p><strong>Règle d'or de l'AVS :</strong></p>
      <p>L'accompagnement doit s'estomper progressivement : Passer de l'aide physique ➔ à l'aide partielle ➔ au geste de pointage ➔ à l'indice verbal ➔ à l'autonomie complète (Prompt Fading). Si l'élève ne progresse qu'en présence exclusive de l'AVS, l'intervention a créé une dépendance artificielle au lieu d'une véritable compétence.</p>
    </div>
    <div class="arabic-text">
      <p><strong>القاعدة الذهبية للمرافق :</strong></p>
      <p>المرافق ليس "معلمًا خاصًا" للتلميذ، وليس مهمته القيام بالمهمة نيابة عنه. الهدف هو تمكين التلميذ من أداء المهمة بنفسه والتدرج من: مساعدة جسدية ➔ مساعدة جزئية ➔ إشارة ➔ تلميح لفظي ➔ استقلالية تامة.</p>
    </div>
  </div>

  <h2>2. Structuration Spatio-Temporelle & Supports Visuels</h2>
  <div class="card-box">
    <h3>A. L'Espace : Des Repères Clairs et Univoques</h3>
    <p>Délimiter visuellement les zones dans la classe : coin travail individuel, coin regroupement, espace d'apaisement sensoriel (avec casque antibruit). Réduire les distracteurs visuels superflus.</p>

    <h3>B. Le Temps : L'Emploi du Temps Visuel & La Gestion des Imprévus</h3>
    <p>Remplacer le flux temporel abstrait par un séquençage visuel (pictogrammes, photos ou mots). En cas de changement imprévu : afficher l'activité prévue ➔ barrée ou retirée ➔ afficher immédiatement l'activité de remplacement pour éviter l'angoisse de rupture.</p>

    <h3>C. La Carte « D'abord – Ensuite » (أولًا – ثم)</h3>
    <p>Présenter clairement : <strong>D'ABORD</strong> l'activité demandée (ex. finir 3 lignes d'écriture) ➔ <strong>ENSUITE</strong> l'accès au renforçateur ou à l'activité appréciée (ex. 5 min de dessin ou de puzzle).</p>
  </div>

  <h2>3. Étude de Cas Clinique & Analyse Fonctionnelle ABC</h2>
  <div class="card-box card-box-gold">
    <h3>Cas Concret : L'élève de 8 ans et le refus d'écriture</h3>
    <p><strong>Observation initiale erronée :</strong> « L'élève est agressif, indiscipliné et refuse d'apprendre. »</p>
    <p><strong>Observation objective fonctionnelle :</strong> « Lorsque l'enseignant pose sur sa table une fiche d'écriture comportant une consigne nouvelle et non familière, l'élève déchire immédiatement sa feuille et pleure. »</p>
    
    <table style="margin-top: 12px;">
      <thead>
        <tr>
          <th>A - Antécédent (Avant)</th>
          <th>B - Comportement (Pendant)</th>
          <th>C - Conséquence (Après)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Présentation d'une fiche nouvelle longue, sans modèle visuel préalable.</td>
          <td>Déchire la feuille, pousse les fournitures, crie.</td>
          <td>L'enseignant retire la feuille et renvoie l'élève au fond de la classe (Échappement réussi).</td>
        </tr>
      </tbody>
    </table>

    <p style="margin-top: 12px;"><strong>Fonction du comportement :</strong> Échappement / Évitement d'une tâche perçue comme insurmontable en raison d'un manque de repères visuels.</p>
    <p><strong>Plan d'intervention pédagogique en 6 étapes :</strong></p>
    <ol>
      <li>Découper la tâche en 3 sous-étapes (Task Analysis).</li>
      <li>Fournir un modèle visuel pré-rempli sur la première ligne.</li>
      <li>Commencer par un mot très familier pour sécuriser l'élève.</li>
      <li>Enseigner explicitement l'utilisation de la carte « Aide-moi » ou « Pause » (Functional Communication Training).</li>
      <li>Renforcer immédiatement l'achèvement de la première sous-étape.</li>
      <li>Estomper l'aide de l'AVS au fur et à mesure que la confiance s'installe.</li>
    </ol>
  </div>

  <h2>4. Checklist Interactive en 14 Points pour l'Enseignant & l'AVS</h2>
  <div class="card-box">
    <div class="checklist-item"><div class="check-box"></div><div><strong>1.</strong> L'élève sait-il exactement ce qu'il doit faire ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>2.</strong> L'élève sait-il où il doit effectuer cette tâche ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>3.</strong> L'élève sait-il combien de temps ou combien d'éléments la tâche comprend ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>4.</strong> Les consignes sont-elles courtes, positives et explicites ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>5.</strong> L'élève a-t-il un accès immédiat à son outil de communication (CAA/PECS) ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>6.</strong> La tâche est-elle décomposée en sous-étapes gérables ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>7.</strong> L'environnement a-t-il été épuré des surcharges sensorielles inutiles ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>8.</strong> Un support visuel (modèle ou pictogramme) soutient-il la consigne orale ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>9.</strong> Un temps suffisant de traitement de l'information (pause de 5 secondes) est-il accordé ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>10.</strong> L'aide apportée est-elle strictement limitée au minimum requis ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>11.</strong> Un plan de retrait progressif de l'étayage (Prompt Fading) est-il prévu ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>12.</strong> Des opportunités de généraliser la compétence dans d'autres lieux sont-elles planifiées ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>13.</strong> Les réussites et observations sont-elles partagées régulièrement avec la famille ?</div></div>
    <div class="checklist-item"><div class="check-box"></div><div><strong>14.</strong> L'objectif final vise-t-il le plus haut degré d'autonomie possible pour l'élève ?</div></div>
  </div>

  <!-- ==================== CHAPITRE 3 ==================== -->
  <div class="chapter-divider">
    <div class="chapter-number">Chapitre 3 / الفصل الثالث</div>
    <div class="chapter-title-fr">Les Pratiques Éducatives Fondées sur les Preuves (Evidence-Based Practices - EBP)</div>
    <div class="chapter-title-ar">الممارسات التربوية المبنية على البراهين في تعليم ومرافقة التلاميذ</div>
  </div>

  <h2>1. Définition des EBP & Rigueur Scientifique</h2>
  <p>Une pratique fondée sur les preuves (EBP) désigne l'intégration des <strong>meilleures données probantes de la recherche scientifique</strong> avec l'expertise clinique et pédagogique du professionnel, en tenant compte des caractéristiques uniques de l'élève, de ses valeurs et de ses préférences familiales.</p>

  <h2>2. Panorama des Pratiques Recommandées</h2>
  <div class="card-box">
    <h3>• Entraînement à la Communication Fonctionnelle (FCT)</h3>
    <p>Remplacer un comportement défi (cri, coup, morsure) par un comportement de communication équivalent et acceptable (pointer la carte "Pause", appuyer sur le pictogramme "Aide").</p>

    <h3>• Les Scénarios Sociaux (Social Stories™)</h3>
    <p>Courts récits illustrés décrivant une situation sociale délicate, les indices contextuels et les réponses attendues pour lever l'ambiguïté (ex. "Demain nous avons cours de sport au gymnase").</p>

    <h3>• La Modélisation Vidéo (Video Modeling)</h3>
    <p>Courtes capsules vidéo montrant un pair ou l'élève lui-même accomplissant avec succès la compétence cible (ex. comment faire la queue à la cantine, saluer un camarade).</p>

    <h3>• L'Intervention Médiée par les Pairs (Peer-Mediated Intervention)</h3>
    <p>Former des pairs neurotypiques bienveillants à initier le jeu, respecter le temps de réponse et partager les activités avec l'élève durant les récréations et ateliers.</p>
  </div>

  <h2>3. Matrice de Décision Pédagogique EBP</h2>
  <table>
    <thead>
      <tr>
        <th>Besoin Identifié de l'Élève</th>
        <th>Objectif Mesurable (PEI)</th>
        <th>Pratique Fondée sur les Preuves (EBP)</th>
        <th>Indicateur Observable de Réussite</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Difficulté majeure lors des transitions imprévues.</td>
        <td>Transition sereine entre deux cours sans crise.</td>
        <td>Emploi du temps visuel + Minuteur visuel (Time Timer) + Avertissement préalable.</td>
        <td>4 transitions réussies sur 5 sans agitation verbale ni motrice.</td>
      </tr>
      <tr>
        <td>Cris et pleurs face à un exercice difficile.</td>
        <td>Sollicitation autonome de l'adulte.</td>
        <td>Entraînement à la Communication Fonctionnelle (FCT) avec carte "Aide".</td>
        <td>Utilisation autonome de la carte dans 80% des situations de blocage.</td>
      </tr>
      <tr>
        <td>Incapacité à préparer ses affaires pour la récréation.</td>
        <td>Autonomie complète dans le rangement du cartable.</td>
        <td>Analyse de tâche (Task Analysis) en 6 étapes + Estompage de guidance.</td>
        <td>Réalisation des 6 étapes avec 1 seul indice visuel ou aucun.</td>
      </tr>
      <tr>
        <td>Isolement total et retrait social durant les récréations.</td>
        <td>Interaction partagée avec un pair.</td>
        <td>Intervention médiée par les pairs + Scénario social "Rejoindre un jeu".</td>
        <td>Partage d'un jeu coopératif pendant au moins 5 minutes 2 fois par semaine.</td>
      </tr>
      <tr>
        <td>Oubli régulier des consignes de travail autonome.</td>
        <td>Gestion autonome de la séquence d'exercice.</td>
        <td>Auto-gestion (Self-Management) : Checklist élève à cocher.</td>
        <td>Cochage et validation de la fiche d'exercice sans rappel de l'enseignant.</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Conclusion & Principes Clés d'une École Inclusive</h2>
  <div class="card-box card-box-accent">
    <ol>
      <li><strong>Comprendre avant d'intervenir :</strong> Aucune stratégie ne peut être appliquée à l'aveugle sans analyse préalable.</li>
      <li><strong>Enseigner la compétence plutôt que punir son absence :</strong> Un comportement difficile signale une compétence manquante.</li>
      <li><strong>Rendre l'environnement prévisible :</strong> L'anticipation visuelle est le meilleur rempart contre l'anxiété.</li>
      <li><strong>Guider vers l'autonomie :</strong> L'aide de l'AVS est un pont temporaire vers l'indépendance.</li>
      <li><strong>Garantir un moyen de communication :</strong> La parole n'est pas la seule voie d'expression de la pensée.</li>
      <li><strong>Généraliser au monde réel :</strong> Une compétence acquise n'a de valeur que si l'élève sait l'utiliser en classe, dans la cour et à la maison.</li>
      <li><strong>L'inclusion est l'affaire de tous :</strong> L'école inclusive ne demande pas à l'élève de s'adapter seul, elle s'adapte pour lever les barrières à sa participation.</li>
    </ol>
  </div>

</body>
</html>`;

async function buildPdf() {
  const outputHtmlPath = path.join(__dirname, '../public/documents/guide-complet-autisme-accompagnement-scolaire-anei.html');
  const outputPdfPath = path.join(__dirname, '../public/documents/guide-complet-autisme-accompagnement-scolaire-anei.pdf');
  
  fs.writeFileSync(outputHtmlPath, htmlContent, 'utf-8');
  console.log('HTML guide written to:', outputHtmlPath);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  
  await page.pdf({
    path: outputPdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '15mm',
      bottom: '15mm',
      left: '12mm',
      right: '12mm'
    }
  });

  await browser.close();
  console.log('PDF guide generated successfully at:', outputPdfPath);
}

buildPdf().catch(err => {
  console.error('Failed to generate PDF guide:', err);
  process.exit(1);
});
